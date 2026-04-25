import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { normalizeInventoryPublicUrl } from "@/lib/storage-inventory";
import type { ReviewRow } from "@/types";

export const dynamic = "force-dynamic";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  } as const;
}

function withCors(init: NextResponse) {
  for (const [k, v] of Object.entries(corsHeaders())) {
    init.headers.set(k, v);
  }
  return init;
}

/** BD sin migración 007: modelo y año van en `model` como texto. */
function legacyModelLine(
  vehicle_model: string | null | undefined,
  vehicle_year: number | null | undefined,
): string | null {
  const parts: string[] = [];
  const m = vehicle_model?.trim();
  if (m) parts.push(m);
  if (vehicle_year != null && Number.isFinite(vehicle_year)) {
    parts.push(String(Math.round(vehicle_year)));
  }
  return parts.length ? parts.join(" · ") : null;
}

function isMissingExtendedReviewColumns(err: { message?: string; code?: string } | null) {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("vehicle_model") ||
    msg.includes("vehicle_year") ||
    msg.includes("schema cache") ||
    err?.code === "PGRST204"
  );
}

function normalizeReviewRow(row: ReviewRow): ReviewRow {
  return {
    ...row,
    photo_url: normalizeInventoryPublicUrl(row.photo_url),
  };
}

const optionalUrl = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const yearInRange = z
  .number()
  .int()
  .min(1900)
  .max(2100)
  .nullable();

const reviewSchema = z.object({
  car_id: z.union([z.string().uuid(), z.null()]).optional(),
  name: z.string().min(1),
  location: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  vehicle_model: z.string().optional().nullable(),
  vehicle_year: yearInRange.optional(),
  photo_url: optionalUrl,
  comment: z.string().min(1),
});

/** Listado público (landing / carApi) y panel: mismo origen que GET /api/cars. */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return withCors(
        NextResponse.json({ error: error.message }, { status: 500 }),
      );
    }
    const reviews = (data ?? []).map((row) =>
      normalizeReviewRow(row as ReviewRow),
    );
    return withCors(NextResponse.json({ reviews }));
  } catch (e) {
    console.error(e);
    return withCors(
      NextResponse.json({ error: "Error de base de datos" }, { status: 500 }),
    );
  }
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const v = parsed.data;

  try {
    const supabase = createAdminClient();
    const extendedRow = {
      car_id: v.car_id ?? null,
      name: v.name,
      location: v.location ?? null,
      model: v.model ?? null,
      vehicle_model: v.vehicle_model ?? null,
      vehicle_year: v.vehicle_year ?? null,
      photo_url: v.photo_url ?? null,
      comment: v.comment,
    };

    let result = await supabase
      .from("reviews")
      .insert(extendedRow)
      .select("*")
      .single();

    if (result.error && isMissingExtendedReviewColumns(result.error)) {
      const legacyRow = {
        car_id: extendedRow.car_id,
        name: extendedRow.name,
        location: extendedRow.location,
        model:
          legacyModelLine(
            extendedRow.vehicle_model,
            extendedRow.vehicle_year ?? null,
          ) ?? extendedRow.model,
        photo_url: extendedRow.photo_url,
        comment: extendedRow.comment,
      };
      result = await supabase
        .from("reviews")
        .insert(legacyRow)
        .select("*")
        .single();
    }

    if (result.error) {
      console.error(result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({
      review: result.data ? normalizeReviewRow(result.data as ReviewRow) : result.data,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error de base de datos" },
      { status: 500 },
    );
  }
}
