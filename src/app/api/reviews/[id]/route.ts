import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { normalizeInventoryPublicUrl } from "@/lib/storage-inventory";
import type { ReviewRow } from "@/types";

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

const patchSchema = z
  .object({
    car_id: z.string().uuid().optional().nullable(),
    name: z.string().min(1).optional(),
    location: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    vehicle_model: z.string().optional().nullable(),
    vehicle_year: yearInRange.optional(),
    photo_url: optionalUrl,
    comment: z.string().min(1).optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const supabase = createAdminClient();
    const patch = parsed.data;

    let result = await supabase
      .from("reviews")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (result.error && isMissingExtendedReviewColumns(result.error)) {
      const {
        vehicle_model,
        vehicle_year,
        model: modelPatch,
        ...rest
      } = patch;
      const legacyUpdate = {
        ...rest,
        model:
          legacyModelLine(
            vehicle_model ?? null,
            vehicle_year ?? null,
          ) ?? modelPatch ?? null,
      };
      result = await supabase
        .from("reviews")
        .update(legacyUpdate)
        .eq("id", id)
        .select("*")
        .maybeSingle();
    }

    if (result.error) {
      console.error(result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    if (!result.data) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const row = result.data as ReviewRow;
    return NextResponse.json({
      review: {
        ...row,
        photo_url: normalizeInventoryPublicUrl(row.photo_url),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error de base de datos" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("reviews").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error de base de datos" },
      { status: 500 },
    );
  }
}
