"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AreaChart,
  BarChart,
  DonutChart,
} from "@tremor/react";
import {
  Activity,
  MousePointerClick,
  Phone,
  UserPlus,
  Radio,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { TrackEventType } from "@/types";
import { formatIntegerThousands } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricsPayload = {
  totals: Record<TrackEventType, number>;
  totals24h: Record<TrackEventType, number>;
  leadsTotal: number;
  whatsappTotal: number;
  timeline: { date: string; interactions: number }[];
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

/** Marino, aqua, turquesa, azul rey — paleta Tremor + acentos coherentes */
const CHART_COLORS = ["blue", "cyan", "teal", "sky"] as const;

/** Borde + halo cyan para gráficas y tablas */
const DASHBOARD_CARD_GLOW =
  "border border-cyan-400/50 shadow-[0_0_0_1px_rgba(34,211,238,0.42),0_0_36px_rgba(6,182,212,0.22),0_0_56px_-10px_rgba(59,130,246,0.14)] ring-1 ring-cyan-400/30";

/** Halo acorde al color de cada tarjeta de métricas */
const STAT_CARD_GLOW: Record<
  "indigo" | "cyan" | "amber" | "emerald",
  string
> = {
  indigo:
    "shadow-[0_0_0_1px_rgba(129,140,248,0.5),0_0_34px_rgba(99,102,241,0.28),0_0_52px_-8px_rgba(79,70,229,0.18)] ring-1 ring-indigo-400/45",
  cyan:
    "shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_0_34px_rgba(6,182,212,0.32),0_0_52px_-8px_rgba(14,165,233,0.18)] ring-1 ring-cyan-400/45",
  amber:
    "shadow-[0_0_0_1px_rgba(251,191,36,0.5),0_0_34px_rgba(245,158,11,0.26),0_0_52px_-8px_rgba(217,119,6,0.16)] ring-1 ring-amber-400/40",
  emerald:
    "shadow-[0_0_0_1px_rgba(52,211,153,0.5),0_0_34px_rgba(16,185,129,0.28),0_0_52px_-8px_rgba(5,150,105,0.16)] ring-1 ring-emerald-400/45",
};

const eventLabels: Record<TrackEventType, string> = {
  view_car: "Vistas",
  click_whatsapp: "WhatsApp",
  click_form: "Formulario",
  submit_lead: "Leads",
};

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
      .channel("dashboard-track-events")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "track_events",
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
    ? (Object.keys(totals) as TrackEventType[]).map((k) => ({
        name: eventLabels[k],
        value: totals[k],
      }))
    : [];

  const topCars = (data?.byCar ?? [])
    .filter((c) => c.carId)
    .slice(0, 8)
    .map((c) => ({
      name: `${c.brand} ${c.model}`.slice(0, 28),
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
          accent="from-indigo-600/25 via-blue-950/50 to-slate-950/40"
          borderAccent="border-indigo-400/50"
          iconAccent="bg-indigo-500/15 text-indigo-200"
          glow={STAT_CARD_GLOW.indigo}
          pulseKey={pulse}
        />
        <StatCard
          title="Clics WhatsApp"
          value={totals?.click_whatsapp ?? 0}
          icon={<Phone className="h-5 w-5" />}
          accent="from-cyan-500/25 via-teal-950/40 to-blue-950/30"
          borderAccent="border-cyan-300/55"
          iconAccent="bg-cyan-500/15 text-cyan-200"
          glow={STAT_CARD_GLOW.cyan}
          pulseKey={pulse}
        />
        <StatCard
          title="Clics en formulario"
          value={totals?.click_form ?? 0}
          icon={<MousePointerClick className="h-5 w-5" />}
          accent="from-amber-500/20 via-orange-950/35 to-amber-950/20"
          borderAccent="border-amber-400/50"
          iconAccent="bg-amber-500/15 text-amber-200"
          glow={STAT_CARD_GLOW.amber}
          pulseKey={pulse}
        />
        <StatCard
          title="Leads generados"
          value={totals?.submit_lead ?? 0}
          icon={<UserPlus className="h-5 w-5" />}
          accent="from-emerald-500/25 via-teal-950/35 to-blue-950/30"
          borderAccent="border-emerald-400/50"
          iconAccent="bg-emerald-500/15 text-emerald-200"
          glow={STAT_CARD_GLOW.emerald}
          pulseKey={pulse}
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <Card
          className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-gradient-to-b from-card to-card/50 lg:col-span-3`}
        >
          <CardHeader>
            <CardTitle>Interacciones por día (7 días)</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto pt-2">
            <AreaChart
              className="tremor-chart-transparent h-64"
              data={data?.timeline ?? []}
              index="date"
              categories={["interactions"]}
              colors={["cyan"]}
              showLegend={false}
              showGridLines={true}
              showAnimation={true}
              curveType="natural"
              showGradient={true}
              noDataText="Sin datos aún"
            />
          </CardContent>
        </Card>

        <Card
          className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-gradient-to-b from-card to-card/50 lg:col-span-2`}
        >
          <CardHeader>
            <CardTitle>Distribución de eventos</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto pt-2">
            <DonutChart
              className="h-64"
              data={pieData}
              category="value"
              index="name"
              colors={[...CHART_COLORS]}
              showAnimation={true}
              noDataText="Sin eventos"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-card/80`}>
          <CardHeader>
            <CardTitle>Top autos por interacciones</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto pt-2">
            <BarChart
              className="tremor-chart-transparent h-72"
              data={topCars}
              index="name"
              categories={["interacciones"]}
              colors={["cyan"]}
              layout="vertical"
              showAnimation={true}
              yAxisWidth={112}
              noDataText="Sin datos"
            />
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
                      <time className="shrink-0 text-muted-foreground">
                        {new Date(e.createdAt).toLocaleTimeString("es-MX", {
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
