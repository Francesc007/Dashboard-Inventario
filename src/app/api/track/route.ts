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
  /**
   * Nivel raíz del JSON (landing) → se persiste en la columna `car_label` de
   * `landing_interactions` para el detalle por vehículo en métricas.
   */
  carLabel: z.string().optional().nullable(),
  /** Mismo significado que carLabel; alias snake_case opcional en el body. */
  car_label: z.string().optional().nullable(),
  /** Compatibilidad: si no hay carLabel, se usa para rellenar car_label. */
  vehicleName: z.string().optional().nullable(),
  eventType: z.enum([
    "view_car",
    "car_view",
    "click_whatsapp",
    "click_form",
    "submit_lead",
    "whatsapp_click",
    "form_submit",
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const uuidParse = z.string().uuid();

/** Nombres que envía la landing → columnas canónicas en BD (enum track_event_type). */
function toDbEventType(
  t:
    | "view_car"
    | "car_view"
    | "click_whatsapp"
    | "click_form"
    | "submit_lead"
    | "whatsapp_click"
    | "form_submit",
): "view_car" | "click_whatsapp" | "click_form" | "submit_lead" {
  if (t === "car_view") return "view_car";
  if (t === "whatsapp_click") return "click_whatsapp";
  if (t === "form_submit") return "submit_lead";
  return t;
}

function normalizeCarLabelInput(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function resolveCarId(
  carId: string | null | undefined,
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (carId && uuidParse.safeParse(carId).success) return carId;
  const m = metadata ?? {};
  for (const key of [
    "car_id",
    "carId",
    "vehicle_id",
    "vehicleId",
    "id",
  ] as const) {
    const v = m[key];
    if (typeof v === "string" && uuidParse.safeParse(v).success) return v;
  }
  return null;
}

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

  const {
    carId,
    carLabel,
    car_label: carLabelSnake,
    vehicleName,
    eventType,
    metadata,
  } = parsed.data;
  const meta = { ...(metadata ?? {}) };
  const resolvedCarId = resolveCarId(carId ?? null, meta);

  // 1) Raíz del JSON: carLabel o car_label → columna BD `car_label`
  const fromRootCamel =
    typeof carLabel === "string" ? normalizeCarLabelInput(carLabel) : "";
  const fromRootSnake =
    typeof carLabelSnake === "string"
      ? normalizeCarLabelInput(carLabelSnake)
      : "";
  const fromRoot = fromRootCamel || fromRootSnake || null;
  let carLabelForDb: string | null = fromRoot || null;
  if (!carLabelForDb && typeof vehicleName === "string") {
    const v = normalizeCarLabelInput(vehicleName);
    carLabelForDb = v || null;
  }
  if (!carLabelForDb) {
    const nameFromMeta = [
      meta.car_label,
      meta.carLabel,
      meta.vehicle_name,
      meta.vehicleName,
      meta.model_label,
      meta.modelLabel,
    ].find((v) => typeof v === "string" && String(v).trim());
    if (nameFromMeta) {
      carLabelForDb = normalizeCarLabelInput(String(nameFromMeta)) || null;
    }
  }

  if (carLabelForDb) {
    meta.car_label = carLabelForDb;
    meta.vehicle_name = carLabelForDb;
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("landing_interactions").insert({
      car_id: resolvedCarId,
      event_type: toDbEventType(eventType),
      car_label: carLabelForDb,
      vehicle_name: carLabelForDb,
      metadata: meta,
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
