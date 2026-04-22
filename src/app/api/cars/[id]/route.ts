import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { CAR_GALLERY_MAX_IMAGES } from "@/lib/car-gallery";
import { normalizeCarImageUrls } from "@/lib/storage-inventory";
import type { CarRow } from "@/types";

const optionalUrl = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const patchSchema = z
  .object({
    brand: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    price: z.number().nonnegative().optional(),
    discount_percent: z.number().min(0).max(100).optional(),
    mileage_km: z.number().int().nonnegative().optional(),
    engine: z.string().optional().nullable(),
    acceleration_0_100_sec: z.number().nonnegative().optional().nullable(),
    power_hp: z.number().int().nonnegative().optional().nullable(),
    condition: z.enum(["nuevo", "seminuevo"]).optional(),
    cover_image_url: optionalUrl,
    gallery_urls: z
      .array(z.string().url())
      .max(CAR_GALLERY_MAX_IMAGES)
      .optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ car: normalizeCarImageUrls(data as CarRow) });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error de base de datos" },
      { status: 500 },
    );
  }
}

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
    const { data, error } = await supabase
      .from("cars")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ car: normalizeCarImageUrls(data as CarRow) });
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
    const { error } = await supabase.from("cars").delete().eq("id", id);

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
