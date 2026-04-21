import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { normalizeInventoryPublicUrl } from "@/lib/storage-inventory";
import { METRICS_TIMEZONE } from "@/lib/metrics-timezone";
import type { TrackEventType } from "@/types";

function dateKeyInTz(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: tz });
}

/** Últimos 7 días calendario en `tz`, de más antiguo a más reciente (YYYY-MM-DD). */
function buildLast7CalendarDayKeys(tz: string): string[] {
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: tz });
  const [y, m, d] = todayStr.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const ms = Date.UTC(y, m - 1, d - i);
    const dt = new Date(ms);
    const yy = dt.getUTCFullYear();
    const mm = dt.getUTCMonth() + 1;
    const dd = dt.getUTCDate();
    keys.push(
      `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
    );
  }
  return keys;
}

function emptyCounts(): Record<TrackEventType, number> {
  return {
    view_car: 0,
    click_whatsapp: 0,
    click_form: 0,
    submit_lead: 0,
  };
}

/**
 * La landing puede enviar el tipo de evento con distintos nombres
 * ("view", "whatsapp", "form_submit", etc.). Lo normalizamos a las 4 claves
 * canónicas que usa el dashboard.
 */
function normalizeEventType(raw: unknown): TrackEventType | null {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (!v) return null;

  if (
    v === "view_car" ||
    v === "view" ||
    v === "view_vehicle" ||
    v === "car_view" ||
    v === "vehicle_view" ||
    v === "product_view" ||
    v === "detail_view"
  ) {
    return "view_car";
  }

  if (
    v === "click_whatsapp" ||
    v === "whatsapp" ||
    v === "whatsapp_click" ||
    v === "wa_click" ||
    v === "click_wa" ||
    v === "whatsapp_cta" ||
    v === "open_whatsapp"
  ) {
    return "click_whatsapp";
  }

  if (
    v === "click_form" ||
    v === "form" ||
    v === "open_form" ||
    v === "form_open" ||
    v === "form_click" ||
    v === "contact_form" ||
    v === "cta_form"
  ) {
    return "click_form";
  }

  if (
    v === "submit_lead" ||
    v === "lead" ||
    v === "lead_submit" ||
    v === "submit_form" ||
    v === "form_submit" ||
    v === "form_sent" ||
    v === "lead_sent"
  ) {
    return "submit_lead";
  }

  return null;
}

function aggregateRows(
  rows: { event_type: string }[],
): Record<TrackEventType, number> {
  const c = emptyCounts();
  for (const r of rows) {
    const t = normalizeEventType(r.event_type);
    if (t) c[t] += 1;
  }
  return c;
}

type EventRow = Record<string, unknown> & {
  id: string;
  event_type: string;
  created_at: string;
};

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const supabase = createAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Traemos TODAS las columnas para poder buscar el car_id aunque viva en
    // otra columna o dentro del payload/metadata.
    const { data: allEvents, error: e1 } = await supabase
      .from("landing_interactions")
      .select("*");

    if (e1) {
      return NextResponse.json({ error: e1.message }, { status: 500 });
    }

    const events = ((allEvents ?? []) as EventRow[]).filter(
      (e) => typeof e.created_at === "string",
    );
    const totals = aggregateRows(events);

    const last24 = events.filter((e) => e.created_at >= since24h);
    const totals24h = aggregateRows(last24);

    const dayKeys = buildLast7CalendarDayKeys(METRICS_TIMEZONE);
    const dayKeySet = new Set(dayKeys);

    const byDay = new Map<string, number>();
    for (const e of events) {
      const k = dateKeyInTz(e.created_at, METRICS_TIMEZONE);
      if (!dayKeySet.has(k)) continue;
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    /** Últimos 7 días calendario en la zona configurada, con 0 si no hubo eventos. */
    const timeline: { date: string; interacciones: number }[] = dayKeys.map(
      (date) => ({
        date,
        interacciones: byDay.get(date) ?? 0,
      }),
    );

    const { data: cars, error: e2 } = await supabase
      .from("cars")
      .select("id, brand, model, cover_image_url");

    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    const carMap = new Map(
      (cars ?? []).map((c) => [
        c.id,
        {
          ...c,
          cover_image_url: normalizeInventoryPublicUrl(c.cover_image_url),
        },
      ]),
    );

    const UUID_RE =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

    /**
     * Búsqueda profunda de un UUID que corresponda a un coche real.
     * Recorre cualquier valor (strings, arrays, objetos) y devuelve el
     * primer UUID que exista en `carMap`.
     */
    function deepFindCarId(value: unknown, depth = 0): string | null {
      if (depth > 6 || value == null) return null;
      if (typeof value === "string") {
        const match = value.match(UUID_RE);
        return match && carMap.has(match[0]) ? match[0] : null;
      }
      if (Array.isArray(value)) {
        for (const v of value) {
          const r = deepFindCarId(v, depth + 1);
          if (r) return r;
        }
        return null;
      }
      if (typeof value === "object") {
        for (const v of Object.values(value as Record<string, unknown>)) {
          const r = deepFindCarId(v, depth + 1);
          if (r) return r;
        }
      }
      return null;
    }

    /** Busca el car_id en TODAS las columnas del evento + metadata/payload. */
    function resolveCarIdFromEventRow(ev: EventRow): string | null {
      // 1) columnas directas habituales
      const direct = [
        ev.car_id,
        ev.carId,
        ev.vehicle_id,
        ev.vehicleId,
        ev.product_id,
        ev.productId,
        ev.auto_id,
        ev.autoId,
      ];
      for (const v of direct) {
        if (typeof v === "string" && carMap.has(v)) return v;
      }
      // 2) cualquier columna del evento + metadata/payload (JSON)
      return deepFindCarId(ev);
    }

    /** Identificador de sesión para la heurística de atribución por cercanía temporal. */
    function sessionKey(ev: EventRow): string | null {
      const candidates = [
        ev.session_id,
        ev.sessionId,
        ev.visitor_id,
        ev.visitorId,
        ev.anonymous_id,
        ev.anonymousId,
        ev.fingerprint,
        ev.user_id,
        ev.userId,
        ev.device_id,
        ev.deviceId,
        ev.ip,
        ev.ip_address,
        ev.ipAddress,
      ];
      for (const v of candidates) {
        if (typeof v === "string" && v) return v;
      }
      const md = ev.metadata as Record<string, unknown> | null | undefined;
      if (md && typeof md === "object") {
        const mdCandidates = [
          md.session_id,
          md.sessionId,
          md.visitor_id,
          md.visitorId,
          md.anonymous_id,
          md.anonymousId,
          md.fingerprint,
          md.user_id,
          md.userId,
          md.device_id,
          md.deviceId,
          md.ip,
        ];
        for (const v of mdCandidates) {
          if (typeof v === "string" && v) return v;
        }
      }
      return null;
    }

    /** ¿El click de WhatsApp viene desde el formulario de contacto? */
    function cameFromForm(ev: EventRow): boolean {
      const targets = [ev.source, ev.origin, ev.from, ev.via, ev.channel];
      for (const v of targets) {
        if (typeof v === "string" && /form|formulario|contact/i.test(v)) {
          return true;
        }
      }
      const md = ev.metadata as Record<string, unknown> | null | undefined;
      if (md && typeof md === "object") {
        for (const key of [
          "source",
          "origin",
          "from",
          "via",
          "channel",
          "flow",
          "cta",
          "trigger",
        ]) {
          const v = md[key];
          if (typeof v === "string" && /form|formulario|contact/i.test(v)) {
            return true;
          }
        }
      }
      return false;
    }

    // --- Preparamos resolución por cercanía temporal ---
    // Ordenamos por tiempo ascendente y guardamos por sesión el último car_id
    // visto (view_car). Ventana: 60 minutos.
    const ATTRIBUTION_WINDOW_MS = 60 * 60 * 1000;
    const sortedAsc = [...events].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const resolvedCarByEventId = new Map<string, string | null>();
    const lastCarBySession = new Map<
      string,
      { carId: string; at: number }
    >();

    for (const e of sortedAsc) {
      const t = normalizeEventType(e.event_type);
      const directCar = resolveCarIdFromEventRow(e);
      let finalCar: string | null = directCar;

      if (!finalCar) {
        // heurística: último view del mismo visitante dentro de la ventana
        const sk = sessionKey(e);
        if (sk) {
          const last = lastCarBySession.get(sk);
          const nowMs = new Date(e.created_at).getTime();
          if (last && nowMs - last.at <= ATTRIBUTION_WINDOW_MS) {
            finalCar = last.carId;
          }
        }
      }

      if (t === "view_car" && directCar) {
        const sk = sessionKey(e);
        if (sk) {
          lastCarBySession.set(sk, {
            carId: directCar,
            at: new Date(e.created_at).getTime(),
          });
        }
      }

      resolvedCarByEventId.set(e.id, finalCar);
    }

    type CarAgg = {
      carId: string | null;
      brand: string;
      model: string;
      cover_image_url: string | null;
      counts: Record<TrackEventType, number>;
      total: number;
    };

    const perCar = new Map<string | "null", CarAgg>();

    function bucket(id: string | null): string | "null" {
      return id ?? "null";
    }

    for (const e of events) {
      const resolvedCarId = resolvedCarByEventId.get(e.id) ?? null;
      const key = bucket(resolvedCarId);
      const car = resolvedCarId ? carMap.get(resolvedCarId) : undefined;
      if (!perCar.has(key)) {
        perCar.set(key, {
          carId: resolvedCarId,
          brand: car?.brand ?? "—",
          model: car?.model ?? "Sin vehículo",
          cover_image_url: car?.cover_image_url ?? null,
          counts: emptyCounts(),
          total: 0,
        });
      }
      const row = perCar.get(key)!;

      let t = normalizeEventType(e.event_type);
      if (!t) continue;

      // Regla: un click de WhatsApp que viene desde el formulario se
      // cuenta como "Form", no como "WA".
      if (t === "click_whatsapp" && cameFromForm(e)) {
        t = "click_form";
      }

      row.counts[t] += 1;
      row.total += 1;

      // Regla: todo contacto (WA o Form) cuenta además como Lead.
      if (t === "click_whatsapp" || t === "click_form") {
        row.counts.submit_lead += 1;
      }
    }

    const byCar = [...perCar.values()].sort((a, b) => b.total - a.total);

    const recentEvents = [...events]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 30)
      .map((e) => {
        const resolvedCarId = resolvedCarByEventId.get(e.id) ?? null;
        return {
          id: e.id,
          carId: resolvedCarId,
          eventType: normalizeEventType(e.event_type) ?? e.event_type,
          createdAt: e.created_at,
          metadata: e.metadata,
          carLabel: resolvedCarId
            ? `${carMap.get(resolvedCarId)?.brand ?? ""} ${carMap.get(resolvedCarId)?.model ?? ""}`.trim()
            : null,
        };
      });

    return NextResponse.json({
      totals,
      totals24h,
      leadsTotal: totals.submit_lead,
      whatsappTotal: totals.click_whatsapp,
      timeline,
      byCar,
      recentEvents,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error de base de datos" },
      { status: 500 },
    );
  }
}
