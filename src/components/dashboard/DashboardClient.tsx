"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AreaChart } from "@tremor/react";
import {
  Activity,
  MousePointerClick,
  Phone,
  UserPlus,
  Radio,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { TrackEventType } from "@/types";
import { METRICS_TIMEZONE } from "@/lib/metrics-timezone";
import { formatIntegerThousands } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricsPayload = {
  totals: Record<TrackEventType, number>;
  totals24h: Record<TrackEventType, number>;
  leadsTotal: number;
  whatsappTotal: number;
  timeline: { date: string; interacciones: number }[];
  byCar: {
    carId: string | null;
    brand: string;
    model: string;
    total: number;
    counts: Record<TrackEventType, number>;
  }[];
  recentEvents: {
    id: string;
    carId: string | null;
    eventType: string;
    createdAt: string;
    metadata: unknown;
    carLabel: string | null;
  }[];
  generatedAt: string;
};

/** Etiqueta compacta dd/mm/aa a partir de YYYY-MM-DD (sin depender de la TZ del navegador). */
function formatDdMmYy(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const yy = String(y % 100).padStart(2, "0");
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${yy}`;
}

function timelineRowsForChart(
  timeline: MetricsPayload["timeline"] | undefined,
): { date: string; interacciones: number; label: string }[] {
  const rows = timeline ?? [];
  return rows.map((row) => ({
    ...row,
    label: formatDdMmYy(row.date),
  }));
}

/** Borde + halo cyan para gráficas y tablas */
const DASHBOARD_CARD_GLOW =
  "border border-cyan-400/50 shadow-[0_0_0_1px_rgba(34,211,238,0.42),0_0_36px_rgba(6,182,212,0.22),0_0_56px_-10px_rgba(59,130,246,0.14)] ring-1 ring-cyan-400/30";

/** Halo acorde al color de cada tarjeta: Vistas morado, WA verde, Formulario ámbar, Leads cian */
const STAT_CARD_GLOW: Record<"vistas" | "whatsapp" | "formulario" | "leads", string> =
  {
    vistas:
      "shadow-[0_0_0_1px_rgba(167,139,250,0.5),0_0_34px_rgba(139,92,246,0.28),0_0_52px_-8px_rgba(109,40,217,0.18)] ring-1 ring-violet-400/45",
    whatsapp:
      "shadow-[0_0_0_1px_rgba(74,222,128,0.5),0_0_34px_rgba(34,197,94,0.28),0_0_52px_-8px_rgba(22,163,74,0.18)] ring-1 ring-green-400/45",
    formulario:
      "shadow-[0_0_0_1px_rgba(251,191,36,0.5),0_0_34px_rgba(245,158,11,0.26),0_0_52px_-8px_rgba(217,119,6,0.16)] ring-1 ring-amber-400/40",
    leads:
      "shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_0_34px_rgba(6,182,212,0.32),0_0_52px_-8px_rgba(14,165,233,0.18)] ring-1 ring-cyan-400/45",
  };

/** Colores alineados con las StatCard y la leyenda del donut (orden fijo por tipo). */
const EVENT_COLOR_HEX: Record<TrackEventType, string> = {
  view_car: "#a855f7",
  click_whatsapp: "#22c55e",
  click_form: "#f59e0b",
  submit_lead: "#06b6d4",
};

const PIE_EVENT_ORDER: TrackEventType[] = [
  "view_car",
  "click_whatsapp",
  "click_form",
  "submit_lead",
];

/** Clases fijas (Tailwind debe ver literales completos en el bundle). */
const PIE_LEGEND_DOT_CLASS = [
  "bg-[#a855f7]",
  "bg-[#22c55e]",
  "bg-[#f59e0b]",
  "bg-[#06b6d4]",
] as const;

const eventLabels: Record<TrackEventType, string> = {
  view_car: "Vistas",
  click_whatsapp: "WhatsApp",
  click_form: "Formulario",
  submit_lead: "Leads",
};

/**
 * Sin UI de tooltip. `showTooltip={false}` en Tremor usa `Fragment` y con React 19
 * Recharts intenta pasar `wrapperStyle` al contenido, lo que dispara error en consola.
 */
function NoopTremorTooltip() {
  return null;
}

/** Barras horizontales sin Recharts: nombres y totales siempre visibles (sin cajas al hover). */
function TopModelsBars({
  rows,
}: {
  rows: { id: string; name: string; interacciones: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.interacciones), 1);
  if (rows.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        Sin datos
      </div>
    );
  }
  return (
    <div className="space-y-4 pt-1">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span
              className="min-w-0 flex-1 truncate font-medium text-foreground"
              title={row.name}
            >
              {row.name}
            </span>
            <span className="shrink-0 tabular-nums text-cyan-400/95">
              {formatIntegerThousands(row.interacciones)}
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40 ring-1 ring-border/50"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-600/90 to-cyan-400/85"
              style={{
                width: `${Math.max(6, (row.interacciones / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut con colores hex reales (sin depender de clases Tremor/Tailwind en node_modules). */
function EventDistributionDonut({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: readonly string[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin eventos
      </div>
    );
  }
  let cum = 0;
  const stops: string[] = [];
  data.forEach((d, i) => {
    const startDeg = (cum / total) * 360;
    cum += d.value;
    const endDeg = (cum / total) * 360;
    stops.push(
      `${colors[i % colors.length]} ${startDeg}deg ${endDeg}deg`,
    );
  });
  const gradient = `conic-gradient(from -90deg, ${stops.join(", ")})`;
  return (
    <div className="flex justify-center">
      <div className="relative h-56 w-56 shrink-0">
        <div
          className="h-full w-full rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          style={{ background: gradient }}
        />
        <div className="absolute left-1/2 top-1/2 h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-card ring-1 ring-white/10" />
      </div>
    </div>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/metrics", { cache: "no-store" });
    if (!res.ok) {
      setErr("No se pudieron cargar las métricas");
      return;
    }
    const json = (await res.json()) as MetricsPayload;
    setData(json);
    setErr(null);
    setPulse((p) => p + 1);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      queueMicrotask(() =>
        setErr("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      );
      return () => clearTimeout(t);
    }

    const channel = supabase
      .channel("dashboard-landing-interactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "landing_interactions",
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      clearTimeout(t);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  if (err && !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200">
        {err}
      </div>
    );
  }

  const totals = data?.totals;
  const pieData = totals
    ? PIE_EVENT_ORDER.map((k) => ({
        name: eventLabels[k],
        value: Number(totals[k]) || 0,
      }))
    : [];

  const areaChartRows = timelineRowsForChart(data?.timeline);

  const topCars = (data?.byCar ?? [])
    .filter((c) => c.carId)
    .slice(0, 8)
    .map((c) => ({
      id: c.carId as string,
      name: `${c.brand} ${c.model}`.trim().slice(0, 56),
      interacciones: c.total,
    }));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            SIGMA AI AGENCY
          </h1>
        </div>
        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-cyan-400/90">
            <Radio className="h-3.5 w-3.5" aria-hidden />
            Conectado
          </span>
        </div>
      </header>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Vistas de autos"
          value={totals?.view_car ?? 0}
          icon={<Activity className="h-5 w-5" />}
          accent="from-violet-600/25 via-purple-950/45 to-slate-950/40"
          borderAccent="border-violet-400/50"
          iconAccent="bg-violet-500/15 text-violet-200"
          glow={STAT_CARD_GLOW.vistas}
          pulseKey={pulse}
        />
        <StatCard
          title="Clics WhatsApp"
          value={totals?.click_whatsapp ?? 0}
          icon={<Phone className="h-5 w-5" />}
          accent="from-green-500/25 via-emerald-950/40 to-slate-950/35"
          borderAccent="border-green-400/50"
          iconAccent="bg-green-500/15 text-green-200"
          glow={STAT_CARD_GLOW.whatsapp}
          pulseKey={pulse}
        />
        <StatCard
          title="Clics en formulario"
          value={totals?.click_form ?? 0}
          icon={<MousePointerClick className="h-5 w-5" />}
          accent="from-amber-500/20 via-orange-950/35 to-amber-950/20"
          borderAccent="border-amber-400/50"
          iconAccent="bg-amber-500/15 text-amber-200"
          glow={STAT_CARD_GLOW.formulario}
          pulseKey={pulse}
        />
        <StatCard
          title="Leads generados"
          value={totals?.submit_lead ?? 0}
          icon={<UserPlus className="h-5 w-5" />}
          accent="from-cyan-500/25 via-sky-950/35 to-slate-950/35"
          borderAccent="border-cyan-400/50"
          iconAccent="bg-cyan-500/15 text-cyan-200"
          glow={STAT_CARD_GLOW.leads}
          pulseKey={pulse}
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card
          className={`flex min-h-0 h-full min-w-0 flex-col ${DASHBOARD_CARD_GLOW} bg-gradient-to-b from-card to-card/50`}
        >
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-base text-foreground">
              Interacciones por día (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-x-auto pt-0 pb-5">
            <div className="min-h-[15rem] w-full flex-1">
              <AreaChart
                className="tremor-chart-transparent h-full min-h-[15rem] [&_.recharts-tooltip-wrapper]:hidden [&_.recharts-tooltip-cursor]:hidden"
                data={areaChartRows}
                index="label"
                categories={["interacciones"]}
                colors={["cyan"]}
                showLegend={true}
                showGridLines={true}
                showAnimation={true}
                curveType="natural"
                showGradient={true}
                customTooltip={NoopTremorTooltip}
                valueFormatter={(v) =>
                  Number.isFinite(Number(v))
                    ? formatIntegerThousands(Math.round(Number(v)))
                    : String(v)
                }
                yAxisWidth={44}
                padding={{ left: 4, right: 4 }}
                rotateLabelX={{
                  angle: -32,
                  verticalShift: 2,
                  xAxisHeight: 44,
                }}
                tickGap={6}
                noDataText="Sin datos aún"
              />
            </div>
            <p className="-mt-1 mb-0.5 text-center text-[11px] font-medium tracking-wide text-muted-foreground">
              Día
            </p>
            <div
              className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto border-t border-border/35 pt-1.5 pb-0.5 sm:mx-0 sm:grid sm:grid-cols-7 sm:gap-1 sm:overflow-visible sm:pb-0 sm:snap-none"
              aria-label="Interacciones por día (valores fijos)"
            >
                {areaChartRows.map((row) => (
                  <div
                    key={row.date}
                    className="flex min-w-[2.75rem] shrink-0 snap-center flex-col items-center gap-0.5 py-0.5 text-center sm:min-w-0"
                  >
                    <span className="text-xs font-semibold tabular-nums text-cyan-400/95">
                      {formatIntegerThousands(row.interacciones)}
                    </span>
                    <span className="text-[10px] tabular-nums leading-none text-muted-foreground/85">
                      {row.label}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`flex min-h-0 h-full min-w-0 flex-col ${DASHBOARD_CARD_GLOW} bg-gradient-to-b from-card to-card/50`}
        >
          <CardHeader className="shrink-0 pb-2">
            <CardTitle>Distribución de eventos</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-x-auto pt-0 pb-5">
            <EventDistributionDonut
              data={pieData}
              colors={PIE_EVENT_ORDER.map((k) => EVENT_COLOR_HEX[k])}
            />
            <div
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
              aria-label="Leyenda de tipos de evento"
            >
              {pieData.map((row, i) => (
                <div key={row.name} className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${PIE_LEGEND_DOT_CLASS[i] ?? "bg-zinc-500"}`}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{row.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-card/80`}>
          <CardHeader>
            <CardTitle>Interacciones por modelos</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 pt-2">
            <TopModelsBars rows={topCars} />
          </CardContent>
        </Card>

        <Card className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-card/80`}>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {(data?.recentEvents?.length ?? 0) === 0 ? (
              <div className="flex min-h-48 items-center justify-center px-4 py-10">
                <p className="text-sm text-muted-foreground">Aún no hay eventos</p>
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {(data?.recentEvents ?? []).map((e) => (
                    <motion.div
                      key={e.id}
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between gap-3 rounded-lg border border-cyan-900/40 bg-muted/30 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {eventLabels[e.eventType as TrackEventType] ??
                            e.eventType}
                        </p>
                        <p className="text-muted-foreground">
                          {e.carLabel || "Sin vehículo asociado"}
                        </p>
                      </div>
                      <time
                        className="shrink-0 text-muted-foreground"
                        dateTime={e.createdAt}
                      >
                        {new Date(e.createdAt).toLocaleTimeString("es-MX", {
                          timeZone: METRICS_TIMEZONE,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </time>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-card/80`}>
        <CardHeader>
          <CardTitle>Detalle por vehículo</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-2">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Vehículo</th>
                <th className="pb-3 pr-4 font-medium">Vistas</th>
                <th className="pb-3 pr-4 font-medium">WhatsApp</th>
                <th className="pb-3 pr-4 font-medium">Form</th>
                <th className="pb-3 pr-4 font-medium">Leads</th>
                <th className="pb-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(data?.byCar ?? []).map((row) => (
                <tr
                  key={row.carId ?? "none"}
                  className="border-b border-border/50 text-foreground/90 last:border-0"
                >
                  <td className="py-3 pr-4">
                    {row.brand} {row.model}
                  </td>
                  <td className="py-3 pr-4">{row.counts.view_car}</td>
                  <td className="py-3 pr-4">{row.counts.click_whatsapp}</td>
                  <td className="py-3 pr-4">{row.counts.click_form}</td>
                  <td className="py-3 pr-4">{row.counts.submit_lead}</td>
                  <td className="py-3 font-semibold text-foreground">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  accent,
  borderAccent,
  iconAccent,
  glow,
  pulseKey,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  borderAccent: string;
  iconAccent: string;
  glow: string;
  pulseKey: number;
}) {
  return (
    <Card
      className={`min-w-0 overflow-hidden border bg-gradient-to-br transition duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:shadow-lg ${glow} ${borderAccent} ${accent}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">
              {title}
            </p>
            <p
              key={pulseKey + title}
              className="mt-2 text-3xl font-semibold tabular-nums text-white"
            >
              {formatIntegerThousands(value)}
            </p>
          </div>
          <div
            className={`rounded-xl p-2.5 ring-1 ring-white/10 ${iconAccent}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
