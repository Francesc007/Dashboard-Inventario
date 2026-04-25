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
    car_id: z.union([z.string().uuid(), z.null()]).optional(),
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

function omitUndefined(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;
}

export async function PATCH(request: Request, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id: rawId } = await params;
  const id = rawId?.trim();
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

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
    const { data: existing, error: existErr } = await supabase
      .from("reviews")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (existErr) {
      console.error(existErr);
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const patch = parsed.data;
    const extendedPayload = omitUndefined({ ...patch } as Record<string, unknown>);

    let up = await supabase
      .from("reviews")
      .update(extendedPayload)
      .eq("id", id);

    if (up.error && isMissingExtendedReviewColumns(up.error)) {
      const {
        vehicle_model,
        vehicle_year,
        model: modelPatch,
        ...rest
      } = patch;
      const legacyUpdate = omitUndefined({
        ...rest,
        model:
          legacyModelLine(
            vehicle_model ?? null,
            vehicle_year ?? null,
          ) ?? modelPatch ?? null,
      });
      up = await supabase.from("reviews").update(legacyUpdate).eq("id", id);
    }

    if (up.error) {
      console.error(up.error);
      return NextResponse.json({ error: up.error.message }, { status: 500 });
    }

    const { data: row, error: selErr } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", id)
      .single();

    if (selErr || !row) {
      console.error(selErr);
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const typed = row as ReviewRow;
    return NextResponse.json({
      review: {
        ...typed,
        photo_url: normalizeInventoryPublicUrl(typed.photo_url),
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
