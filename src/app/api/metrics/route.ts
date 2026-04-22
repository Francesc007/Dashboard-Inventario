import { NextResponse, type NextRequest } from "next/server";
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

type EventRow = Record<string, unknown> & {
  id: string;
  event_type: string;
  created_at: string;
  car_label?: string | null;
  vehicle_name?: string | null;
};

const GENERAL_LABEL = "Consulta General";

function normalizeVehicleLabel(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Agrupación única: columna car_label; solo vehicle_name en filas previas a la migración. */
function carLabelFromEvent(ev: EventRow): string | null {
  const cl = ev.car_label;
  if (typeof cl === "string" && cl.trim()) {
    return normalizeVehicleLabel(cl);
  }
  const legacy = ev.vehicle_name;
  if (typeof legacy === "string" && legacy.trim()) {
    return normalizeVehicleLabel(legacy);
  }
  return null;
}

function isConsultaGeneral(name: string | null): boolean {
  if (!name) return false;
  return (
    normalizeVehicleLabel(name).toLowerCase() ===
    GENERAL_LABEL.toLowerCase()
  );
}

export type MetricsRangeParam = "7d" | "today";

function filterEventsForRange(
  events: EventRow[],
  range: MetricsRangeParam,
  tz: string,
): EventRow[] {
  if (range === "today") {
    const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: tz });
    return events.filter((e) => dateKeyInTz(e.created_at, tz) === todayKey);
  }
  const allowed = new Set(buildLast7CalendarDayKeys(tz));
  return events.filter((e) => allowed.has(dateKeyInTz(e.created_at, tz)));
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

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const range: MetricsRangeParam =
      request.nextUrl.searchParams.get("range") === "today" ? "today" : "7d";

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
    const scopedEvents = filterEventsForRange(events, range, METRICS_TIMEZONE);
    const totals = aggregateRows(scopedEvents);

    const last24 = scopedEvents.filter((e) => e.created_at >= since24h);
    const totals24h = aggregateRows(last24);

    const dayKeys = buildLast7CalendarDayKeys(METRICS_TIMEZONE);
    const dayKeySet = new Set(dayKeys);

    const byDay = new Map<string, number>();
    for (const e of scopedEvents) {
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

    type CarAgg = {
      carId: string | null;
      /** Texto mostrado = valor de car_label en BD (normalizado). */
      carLabel: string;
      brand: string;
      model: string;
      cover_image_url: string | null;
      counts: Record<TrackEventType, number>;
      total: number;
    };

    type BucketInfo = {
      mapKey: string;
      carId: string | null;
      brand: string;
      model: string;
      /** Misma cadena que agrupa filas (car_label). */
      displayLabel: string;
      cover_image_url: string | null;
    };

    function findCarIdByVehicleName(name: string): string | null {
      const n = normalizeVehicleLabel(name).toLowerCase();
      for (const [id, car] of carMap) {
        const full = normalizeVehicleLabel(
          `${car.brand} ${car.model}`,
        ).toLowerCase();
        if (full === n) return id;
      }
      return null;
    }

    function resolveBucket(ev: EventRow): BucketInfo {
      const raw = carLabelFromEvent(ev);
      const norm = raw ? normalizeVehicleLabel(raw) : "";
      if (!norm || isConsultaGeneral(norm)) {
        return {
          mapKey: "__consulta_general__",
          carId: null,
          brand: "",
          model: GENERAL_LABEL,
          displayLabel: GENERAL_LABEL,
          cover_image_url: null,
        };
      }
      const mapKey = `__lbl:${norm.toLowerCase()}`;
      const byName = findCarIdByVehicleName(norm);
      if (byName) {
        const car = carMap.get(byName)!;
        return {
          mapKey,
          carId: byName,
          brand: car.brand,
          model: car.model,
          displayLabel: norm,
          cover_image_url: car.cover_image_url,
        };
      }
      return {
        mapKey,
        carId: null,
        brand: "",
        model: norm,
        displayLabel: norm,
        cover_image_url: null,
      };
    }

    function activityLabelForBucket(
      t: TrackEventType,
      b: BucketInfo,
    ): string {
      const line = b.displayLabel;
      if (t === "submit_lead") return `Lead · ${line}`;
      if (t === "click_whatsapp") {
        if (
          b.mapKey === "__consulta_general__" ||
          line === GENERAL_LABEL
        ) {
          return "WA General";
        }
        return `Solicitar información · ${line}`;
      }
      if (t === "view_car") return `Vista · ${line}`;
      if (t === "click_form") return `Formulario · ${line}`;
      return line;
    }

    const perCar = new Map<string, CarAgg>();

    for (const e of scopedEvents) {
      const b = resolveBucket(e);
      const t = normalizeEventType(e.event_type);
      if (!t) continue;

      if (!perCar.has(b.mapKey)) {
        perCar.set(b.mapKey, {
          carId: b.carId,
          carLabel: b.displayLabel,
          brand: b.brand,
          model: b.model,
          cover_image_url: b.cover_image_url,
          counts: emptyCounts(),
          total: 0,
        });
      }
      const row = perCar.get(b.mapKey)!;
      row.counts[t] += 1;
      row.total += 1;
    }

    const byCar = [...perCar.values()].sort((a, b) => b.total - a.total);

    const recentEvents = [...scopedEvents]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 30)
      .map((e) => {
        const b = resolveBucket(e);
        const t = normalizeEventType(e.event_type);
        return {
          id: e.id,
          carId: b.carId,
          eventType: t ?? e.event_type,
          createdAt: e.created_at,
          metadata: e.metadata,
          carLabel: b.displayLabel,
          activityLabel: t ? activityLabelForBucket(t, b) : String(e.event_type),
        };
      });

    const vistas = totals.view_car;
    const leadsConversions = totals.submit_lead + totals.click_whatsapp;
    const conversionRate =
      vistas > 0
        ? Math.round((leadsConversions / vistas) * 1000) / 10
        : null;

    return NextResponse.json({
      totals,
      totals24h,
      leadsTotal: leadsConversions,
      whatsappTotal: totals.click_whatsapp,
      conversionRate,
      metricsRange: range,
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
