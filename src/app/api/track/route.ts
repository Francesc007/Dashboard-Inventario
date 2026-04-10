import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  corsPreflightResponse,
  isTrackOriginAllowed,
  withCors,
} from "@/lib/cors";

const bodySchema = z.object({
  carId: z.string().uuid().optional().nullable(),
  eventType: z.enum([
    "view_car",
    "click_whatsapp",
    "click_form",
    "submit_lead",
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  if (!isTrackOriginAllowed(request)) {
    return NextResponse.json(
      { error: "Origen no permitido por CORS" },
      { status: 403 },
    );
  }

  const trackKey = process.env.TRACK_API_KEY;
  if (trackKey) {
    const sent = request.headers.get("x-track-key");
    if (sent !== trackKey) {
      const res = NextResponse.json({ error: "No autorizado" }, { status: 401 });
      return withCors(request, res);
    }
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    const res = NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    return withCors(request, res);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const res = NextResponse.json(
      { error: "Validación", details: parsed.error.flatten() },
      { status: 422 },
    );
    return withCors(request, res);
  }

  const { carId, eventType, metadata } = parsed.data;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("track_events").insert({
      car_id: carId ?? null,
      event_type: eventType,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error(error);
      const res = NextResponse.json(
        { error: "No se pudo guardar el evento" },
        { status: 500 },
      );
      return withCors(request, res);
    }

    const res = NextResponse.json({ ok: true });
    return withCors(request, res);
  } catch (e) {
    console.error(e);
    const res = NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500 },
    );
    return withCors(request, res);
  }
}
