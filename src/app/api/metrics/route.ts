import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { normalizeInventoryPublicUrl } from "@/lib/storage-inventory";
import type { TrackEventType } from "@/types";

function emptyCounts(): Record<TrackEventType, number> {
  return {
    view_car: 0,
    click_whatsapp: 0,
    click_form: 0,
    submit_lead: 0,
  };
}

function aggregateRows(
  rows: { event_type: string }[],
): Record<TrackEventType, number> {
  const c = emptyCounts();
  for (const r of rows) {
    const t = r.event_type as TrackEventType;
    if (t in c) c[t] += 1;
  }
  return c;
}

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const supabase = createAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allEvents, error: e1 } = await supabase
      .from("track_events")
      .select("id, car_id, event_type, created_at, metadata");

    if (e1) {
      return NextResponse.json({ error: e1.message }, { status: 500 });
    }

    const events = allEvents ?? [];
    const totals = aggregateRows(events);

    const last24 = events.filter((e) => e.created_at >= since24h);
    const totals24h = aggregateRows(last24);

    const last7 = events.filter((e) => e.created_at >= since7d);

    const byDay = new Map<string, number>();
    for (const e of last7) {
      const d = e.created_at.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const timeline = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, interactions]) => ({ date, interactions }));

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
      const key = bucket(e.car_id as string | null);
      const car = e.car_id ? carMap.get(e.car_id) : undefined;
      if (!perCar.has(key)) {
        perCar.set(key, {
          carId: e.car_id as string | null,
          brand: car?.brand ?? "—",
          model: car?.model ?? "Sin vehículo",
          cover_image_url: car?.cover_image_url ?? null,
          counts: emptyCounts(),
          total: 0,
        });
      }
      const row = perCar.get(key)!;
      const t = e.event_type as TrackEventType;
      if (t in row.counts) {
        row.counts[t] += 1;
        row.total += 1;
      }
    }

    const byCar = [...perCar.values()].sort((a, b) => b.total - a.total);

    const recentEvents = [...events]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 30)
      .map((e) => ({
        id: e.id,
        carId: e.car_id,
        eventType: e.event_type,
        createdAt: e.created_at,
        metadata: e.metadata,
        carLabel: e.car_id
          ? `${carMap.get(e.car_id)?.brand ?? ""} ${carMap.get(e.car_id)?.model ?? ""}`.trim()
          : null,
      }));

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
