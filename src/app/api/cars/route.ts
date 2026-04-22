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

const carSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  price: z.number().nonnegative(),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  mileage_km: z.number().int().nonnegative().optional().default(0),
  engine: z.string().optional().nullable(),
  acceleration_0_100_sec: z.number().nonnegative().optional().nullable(),
  power_hp: z.number().int().nonnegative().optional().nullable(),
  condition: z.enum(["nuevo", "seminuevo"]),
  cover_image_url: optionalUrl,
  gallery_urls: z
    .array(z.string().url())
    .max(CAR_GALLERY_MAX_IMAGES)
    .optional()
    .default([]),
});

export const dynamic = "force-dynamic"; // Evita caché

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("cars").select("*");

    if (error) {
      const response = NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      return response;
    }

    const cars = (data ?? []).map((row) =>
      normalizeCarImageUrls(row as CarRow),
    );
    const response = NextResponse.json({ cars });

    // Cabeceras forzadas
    response.headers.set(
      "Access-Control-Allow-Origin",
      "*",
    ); // '*' es más permisivo para pruebas
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    return response;
  } catch {
    const response = NextResponse.json({ error: "Error" }, { status: 500 });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    return response;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  return response;
}

/** Creación desde el panel (requiere sesión). No aplica CORS público. */
export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = carSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const v = parsed.data;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cars")
      .insert({
        brand: v.brand,
        model: v.model,
        year: v.year,
        price: v.price,
        discount_percent: v.discount_percent,
        mileage_km: v.mileage_km,
        engine: v.engine ?? null,
        acceleration_0_100_sec: v.acceleration_0_100_sec ?? null,
        power_hp: v.power_hp ?? null,
        condition: v.condition,
        cover_image_url: v.cover_image_url ?? null,
        gallery_urls: v.gallery_urls ?? [],
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      car: data ? normalizeCarImageUrls(data as CarRow) : data,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error de base de datos" },
      { status: 500 },
    );
  }
}
