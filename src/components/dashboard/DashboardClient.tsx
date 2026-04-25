"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
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
import { cn, formatIntegerThousands } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONSULTA_GENERAL_LABEL = "Consulta General";

/** Vistas, Form y Leads: sin mostrar 0 en celdas del detalle. */
function detailColHideZero(n: number): string | number {
  return n === 0 ? "" : n;
}

/** Consulta General: total coherente con lo mostrado (vistas + WA; sin form/leads). */
function consultaGeneralDisplayedTotal(row: {
  counts: Record<TrackEventType, number>;
}): number {
  return row.counts.view_car + row.counts.click_whatsapp;
}

type MetricsRange = "7d" | "today";

type MetricsPayload = {
  totals: Record<TrackEventType, number>;
  totals24h: Record<TrackEventType, number>;
  leadsTotal: number;
  whatsappTotal: number;
  conversionRate: number | null;
  metricsRange: MetricsRange;
  timeline: { date: string; interacciones: number }[];
  byCar: {
    carId: string | null;
    carLabel: string;
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
    activityLabel: string;
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

/** Al hover: más brillo y borde (evita `hover:shadow-lg`, que sustituía el halo y lo apagaba). */
const STAT_CARD_GLOW_HOVER: Record<
  "vistas" | "whatsapp" | "formulario" | "leads",
  string
> = {
  vistas:
    "hover:shadow-[0_0_0_1px_rgba(196,181,253,0.75),0_0_52px_rgba(139,92,246,0.45),0_0_80px_-6px_rgba(109,40,217,0.32)] hover:ring-2 hover:ring-violet-300/70",
  whatsapp:
    "hover:shadow-[0_0_0_1px_rgba(134,239,172,0.85),0_0_52px_rgba(34,197,94,0.45),0_0_80px_-6px_rgba(22,163,74,0.32)] hover:ring-2 hover:ring-green-300/70",
  formulario:
    "hover:shadow-[0_0_0_1px_rgba(253,224,71,0.8),0_0_50px_rgba(245,158,11,0.42),0_0_78px_-6px_rgba(217,119,6,0.28)] hover:ring-2 hover:ring-amber-300/65",
  leads:
    "hover:shadow-[0_0_0_1px_rgba(103,232,249,0.85),0_0_52px_rgba(6,182,212,0.48),0_0_80px_-6px_rgba(14,165,233,0.3)] hover:ring-2 hover:ring-cyan-300/70",
};

/**
 * Misma métrica y orden que las tarjetas principales: WA, Vistas, Form, Leads.
 */
const MAIN_METRICS_PIE_COLORS = [
  "#22c55e",
  "#5b21b6",
  "#f59e0b",
  "#06b6d4",
] as const;

const MAIN_METRICS_PIE_LEGEND_DOT = [
  "bg-[#22c55e]",
  "bg-[#5b21b6]",
  "bg-[#f59e0b]",
  "bg-[#06b6d4]",
] as const;

/** Escala del eje Y del área (interacciones/día): máximo redondeado según los datos. */
function niceYAxisMaxForTimeline(values: number[]): number {
  const maxVal = Math.max(0, ...values);
  if (maxVal <= 0) return 5;
  if (maxVal <= 5) return 5;
  if (maxVal <= 10) return 10;
  const padded = Math.ceil(maxVal * 1.12);
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  return Math.max(10, Math.ceil(padded / magnitude) * magnitude);
}

/** Valores del eje Y junto a cada línea horizontal (p. ej. 0,1,2… o 0,2,4…). */
function computeYAxisTicks(yMax: number): number[] {
  if (yMax <= 0) return [0, 1, 2, 3, 4, 5];
  let step = Math.ceil(yMax / 5);
  if (step < 1) step = 1;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const normalized = magnitude > 0 ? step / magnitude : step;
  if (normalized <= 1) step = magnitude;
  else if (normalized <= 2) step = 2 * magnitude;
  else if (normalized <= 5) step = 5 * magnitude;
  else step = 10 * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) {
    ticks.push(v);
  }
  if (ticks[ticks.length - 1] < yMax) ticks.push(yMax);
  return ticks;
}

const INTERACCIONES_AREA_GRADIENT_ID = "dashboard-interacciones-area-fill";

function InteractionsTimelineChart({
  rows,
  yMax,
}: {
  rows: { date: string; interacciones: number; label: string }[];
  yMax: number;
}) {
  const ticks = computeYAxisTicks(yMax);
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[15rem] items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }
  return (
    <div className="tremor-chart-transparent h-full min-h-[15rem] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={240}>
        <RechartsAreaChart
          data={rows}
          margin={{ top: 8, right: 8, left: 2, bottom: 6 }}
        >
          <defs>
            <linearGradient
              id={INTERACCIONES_AREA_GRADIENT_ID}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor="rgb(34, 211, 238)"
                stopOpacity={0.42}
              />
              <stop
                offset="92%"
                stopColor="rgb(34, 211, 238)"
                stopOpacity={0.04}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            opacity={0.75}
          />
          <XAxis dataKey="label" hide />
          <YAxis
            width={44}
            domain={[0, yMax]}
            ticks={ticks}
            tick={{
              fill: "hsl(var(--foreground))",
              fontSize: 11,
              fontWeight: 500,
            }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatIntegerThousands(Number(v))}
            allowDecimals={false}
          />
          <Area
            type="monotone"
            dataKey="interacciones"
            name="Interacciones"
            stroke="rgb(34, 211, 238)"
            strokeWidth={2}
            fill={`url(#${INTERACCIONES_AREA_GRADIENT_ID})`}
            isAnimationActive
            animationDuration={550}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
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

/** Arco semicircular (abre hacia arriba): de izquierda a derecha por el “techo”. */
function semiArcPathD(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function mixHex(hex: string, toward: "white" | "black", t: number): string {
  const { r, g, b } = hexToRgb(hex);
  const m = toward === "white" ? 255 : 0;
  const l = (x: number) => Math.round(x + (m - x) * t);
  return `rgb(${l(r)},${l(g)},${l(b)})`;
}

/**
 * Distribución como arcos concéntricos semicirculares; relieve 3D (perspectiva, sombra, degradado en trazo).
 */
function EventDistributionRadial({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: readonly string[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-52 min-w-[200px] items-center justify-center text-sm text-muted-foreground">
        Sin eventos
      </div>
    );
  }

  const cx = 100;
  const cy = 100;
  const radii = [86, 68, 50, 32];
  const strokeW = 7;

  return (
    <div className="relative flex w-full flex-col items-center pb-2 pt-1 [perspective:640px]">
      {/* Sombra de suelo (profundidad) */}
      <div
        className="pointer-events-none absolute left-1/2 top-[72%] z-0 h-[11%] w-[68%] max-w-[280px] -translate-x-1/2 rounded-[100%] bg-black/40 blur-[22px]"
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-[320px] origin-center [transform:rotateX(10deg)]"
        style={{ transformStyle: "preserve-3d" }}
      >
        <svg
          viewBox="0 0 200 118"
          className="h-auto w-full overflow-visible drop-shadow-[0_16px_32px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.35)]"
          aria-hidden
        >
          <defs>
            <radialGradient id="radialArcSheenGlobal" cx="42%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="55%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <filter
              id="radialArcSoftGlow"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {colors.map((c, i) => (
              <linearGradient
                key={i}
                id={`arcStroke3d-${i}`}
                x1="100"
                y1="48"
                x2="100"
                y2="108"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={mixHex(c, "white", 0.38)} />
                <stop offset="45%" stopColor={c} />
                <stop offset="100%" stopColor={mixHex(c, "black", 0.35)} />
              </linearGradient>
            ))}
          </defs>

          <ellipse
            cx={cx}
            cy={cy - 38}
            rx="78"
            ry="36"
            fill="url(#radialArcSheenGlobal)"
            className="pointer-events-none opacity-[0.22]"
          />

          {radii.map((r, i) => {
            const v = data[i]?.value ?? 0;
            const share = v / total;
            const d = semiArcPathD(cx, cy, r);

            return (
              <g key={i}>
                {/* “Extrusión” sutil detrás del trazo coloreado */}
                {share > 0 && (
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    transform="translate(1.5, 2.2)"
                    opacity={0.55}
                  />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                />
                {share > 0 && (
                  <motion.path
                    d={d}
                    fill="none"
                    pathLength={1}
                    stroke={`url(#arcStroke3d-${i})`}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    filter="url(#radialArcSoftGlow)"
                    initial={{ pathLength: 0, opacity: 0.88 }}
                    animate={{ pathLength: share, opacity: 1 }}
                    transition={{
                      pathLength: {
                        duration: 0.9,
                        delay: 0.07 * i,
                        ease: [0.22, 1, 0.36, 1],
                      },
                      opacity: { duration: 0.35, delay: 0.07 * i },
                    }}
                  />
                )}
              </g>
            );
          })}

          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-foreground text-[17px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
            style={{ fontFamily: "inherit" }}
          >
            {formatIntegerThousands(total)}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px] uppercase tracking-wider drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
            style={{ fontFamily: "inherit" }}
          >
            eventos
          </text>
        </svg>
      </div>
    </div>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [metricsRange, setMetricsRange] = useState<MetricsRange>("7d");

  const load = useCallback(async () => {
    const res = await fetch(`/api/metrics?range=${metricsRange}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setErr("No se pudieron cargar las métricas");
      return;
    }
    const json = (await res.json()) as MetricsPayload;
    setData(json);
    setErr(null);
    setPulse((p) => p + 1);
  }, [metricsRange]);

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

  const areaChartRows = timelineRowsForChart(data?.timeline);
  const areaChartYMax = niceYAxisMaxForTimeline(
    areaChartRows.map((r) => r.interacciones),
  );

  const TOP_MODELS_MAX = 8;
  const rawByCar = data?.byCar ?? [];
  const consultaForTop = rawByCar.filter(
    (r) => r.carLabel === CONSULTA_GENERAL_LABEL,
  );
  const vehiclesForTop = rawByCar.filter(
    (r) => r.carLabel !== CONSULTA_GENERAL_LABEL,
  );
  const sortedVehiclesForTop = [...vehiclesForTop].sort(
    (a, b) => b.total - a.total,
  );
  const vehicleSlots =
    consultaForTop.length > 0
      ? TOP_MODELS_MAX - consultaForTop.length
      : TOP_MODELS_MAX;
  const topCars = [
    ...sortedVehiclesForTop.slice(0, Math.max(0, vehicleSlots)).map((c) => ({
      id: c.carId ?? `lbl-${c.carLabel}`,
      name: c.carLabel.slice(0, 56),
      interacciones: c.total,
    })),
    ...consultaForTop.map((c) => ({
      id: c.carId ?? `lbl-${c.carLabel}`,
      name: `WA · ${c.carLabel}`.slice(0, 56),
      interacciones: consultaGeneralDisplayedTotal(c),
    })),
  ];

  const detailRaw = data?.byCar ?? [];
  const detailConsulta = detailRaw.filter(
    (r) => r.carLabel === CONSULTA_GENERAL_LABEL,
  );
  const detailVehicles = detailRaw.filter(
    (r) => r.carLabel !== CONSULTA_GENERAL_LABEL,
  );
  const detailTableRows = [
    ...[...detailVehicles].sort((a, b) => b.total - a.total),
    ...detailConsulta,
  ];

  /** Vistas, Form y Leads del encabezado: solo filas de modelos (sin Consulta General). */
  const detailTotalsModelsOnly = detailVehicles.reduce(
    (acc, row) => {
      const leads = row.counts.click_whatsapp + row.counts.submit_lead;
      return {
        view_car: acc.view_car + row.counts.view_car,
        submit_lead: acc.submit_lead + row.counts.submit_lead,
        leads: acc.leads + leads,
        rowTotalSum: acc.rowTotalSum + row.total,
      };
    },
    { view_car: 0, submit_lead: 0, leads: 0, rowTotalSum: 0 },
  );

  /** WhatsApp en encabezado: suma de toda la columna (modelos + Consulta General). */
  const detailTotalsWhatsappAll = detailTableRows.reduce(
    (s, row) => s + row.counts.click_whatsapp,
    0,
  );

  /** Total (última columna): suma de lo mostrado en cada fila. */
  const detailGrandTotal =
    detailTotalsModelsOnly.rowTotalSum +
    detailConsulta.reduce((s, row) => s + consultaGeneralDisplayedTotal(row), 0);

  const detailConversionRate =
    detailTotalsModelsOnly.view_car > 0
      ? Math.round(
          (detailTotalsModelsOnly.leads / detailTotalsModelsOnly.view_car) *
            1000,
        ) / 10
      : null;

  const mainMetricsPie = data
    ? [
        { name: "WA", value: detailTotalsWhatsappAll },
        { name: "Vistas", value: detailTotalsModelsOnly.view_car },
        { name: "Form", value: detailTotalsModelsOnly.submit_lead },
        { name: "Leads", value: detailTotalsModelsOnly.leads },
      ]
    : [];
  const mainMetricsPieTotal = mainMetricsPie.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            SIGMA AI AGENCY
          </h1>
        </div>
        <div className="mt-3 flex flex-row flex-wrap items-center justify-center gap-3 sm:mt-5 sm:justify-end sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400/95">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              Conectado
            </span>
          </div>
          <div
            className="inline-flex rounded-lg border border-cyan-500/35 bg-muted/25 p-0.5 shadow-inner shadow-black/20"
            role="group"
            aria-label="Rango de fechas de las métricas"
          >
            <button
              type="button"
              onClick={() => setMetricsRange("7d")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                metricsRange === "7d"
                  ? "bg-cyan-500/25 text-cyan-100 shadow-sm ring-1 ring-cyan-400/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              onClick={() => setMetricsRange("today")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                metricsRange === "today"
                  ? "bg-cyan-500/25 text-cyan-100 shadow-sm ring-1 ring-cyan-400/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Hoy
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="WA"
          value={detailTotalsWhatsappAll}
          icon={<Phone className="h-5 w-5" />}
          accent="from-green-500/25 via-emerald-950/40 to-slate-950/35"
          borderAccent="border-green-400/50 hover:border-green-300/75"
          iconAccent="bg-green-500/15 text-green-200"
          glow={STAT_CARD_GLOW.whatsapp}
          glowHover={STAT_CARD_GLOW_HOVER.whatsapp}
          pulseKey={pulse}
        />
        <StatCard
          title="Vistas"
          value={detailTotalsModelsOnly.view_car}
          icon={<Activity className="h-5 w-5" />}
          accent="from-violet-600/25 via-purple-950/45 to-slate-950/40"
          borderAccent="border-violet-400/50 hover:border-violet-300/75"
          iconAccent="bg-violet-500/15 text-violet-200"
          glow={STAT_CARD_GLOW.vistas}
          glowHover={STAT_CARD_GLOW_HOVER.vistas}
          pulseKey={pulse}
        />
        <StatCard
          title="Form"
          value={detailTotalsModelsOnly.submit_lead}
          icon={<MousePointerClick className="h-5 w-5" />}
          accent="from-amber-500/20 via-orange-950/35 to-amber-950/20"
          borderAccent="border-amber-400/50 hover:border-amber-300/75"
          iconAccent="bg-amber-500/15 text-amber-200"
          glow={STAT_CARD_GLOW.formulario}
          glowHover={STAT_CARD_GLOW_HOVER.formulario}
          pulseKey={pulse}
        />
        <StatCard
          title="Leads"
          value={detailTotalsModelsOnly.leads}
          icon={<UserPlus className="h-5 w-5" />}
          accent="from-cyan-500/25 via-sky-950/35 to-slate-950/35"
          borderAccent="border-cyan-400/50 hover:border-cyan-300/80"
          iconAccent="bg-cyan-500/15 text-cyan-200"
          glow={STAT_CARD_GLOW.leads}
          glowHover={STAT_CARD_GLOW_HOVER.leads}
          pulseKey={pulse}
          footer={
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100/90">
                % de conversión
              </p>
              <p className="text-lg font-bold tabular-nums leading-none text-white">
                {detailConversionRate != null
                  ? `${detailConversionRate.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`
                  : "—"}
              </p>
            </div>
          }
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card
          className={`flex min-h-0 h-full min-w-0 flex-col ${DASHBOARD_CARD_GLOW} bg-gradient-to-b from-card to-card/50`}
        >
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="uppercase tracking-wide">
              Interacciones por día
              {metricsRange === "today" ? " (hoy)" : " (últimos 7 días)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-x-auto pt-0 pb-5">
            <div className="min-h-[15rem] w-full flex-1">
              <InteractionsTimelineChart
                rows={areaChartRows}
                yMax={areaChartYMax}
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
                      {row.interacciones === 0
                        ? "—"
                        : formatIntegerThousands(row.interacciones)}
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
            <CardTitle className="uppercase tracking-wide">
              Distribución de eventos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-auto pt-0 pb-5">
            <EventDistributionRadial
              data={mainMetricsPie}
              colors={MAIN_METRICS_PIE_COLORS}
            />
            <ul
              className="w-full min-w-0 space-y-2.5 text-sm"
              aria-label="Leyenda de tipos de evento"
            >
              {mainMetricsPie.map((row, i) => {
                const pct =
                  mainMetricsPieTotal > 0
                    ? Math.round((row.value / mainMetricsPieTotal) * 100)
                    : 0;
                return (
                  <li
                    key={`${row.name}-${i}`}
                    className="flex items-center justify-between gap-3 border-b border-border/35 pb-2.5 last:border-0 last:pb-0"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${MAIN_METRICS_PIE_LEGEND_DOT[i] ?? "bg-zinc-500"}`}
                        aria-hidden
                      />
                      <span className="truncate text-muted-foreground">
                        {row.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums text-foreground/90">
                      {formatIntegerThousands(row.value)}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({pct}%)
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-card/80`}>
          <CardHeader>
            <CardTitle className="uppercase tracking-wide">
              Interacciones por modelos
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 pt-2">
            <TopModelsBars rows={topCars} />
          </CardContent>
        </Card>

        <Card className={`min-w-0 ${DASHBOARD_CARD_GLOW} bg-card/80`}>
          <CardHeader>
            <CardTitle className="uppercase tracking-wide">
              Actividad reciente
            </CardTitle>
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
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {e.activityLabel ?? e.eventType ?? "Evento"}
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
          <CardTitle className="uppercase tracking-wide">
            Detalle por vehículo
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-2">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-3 pr-4 text-left font-medium">Vehículo</th>
                <th className="pb-3 px-2 text-center font-medium">WhatsApp</th>
                <th className="pb-3 px-2 text-center font-medium">Vistas</th>
                <th className="pb-3 px-2 text-center font-medium">Form</th>
                <th className="pb-3 px-2 text-center font-medium">Leads</th>
                <th className="pb-3 pl-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-border bg-muted/25 text-foreground">
                <td className="py-3 pr-4 text-left font-semibold">Total</td>
                <td className="py-3 px-2 text-center tabular-nums font-medium">
                  {formatIntegerThousands(detailTotalsWhatsappAll)}
                </td>
                <td className="py-3 px-2 text-center tabular-nums font-medium">
                  {formatIntegerThousands(detailTotalsModelsOnly.view_car)}
                </td>
                <td className="py-3 px-2 text-center tabular-nums font-medium">
                  {formatIntegerThousands(detailTotalsModelsOnly.submit_lead)}
                </td>
                <td className="py-3 px-2 text-center tabular-nums font-medium">
                  {formatIntegerThousands(detailTotalsModelsOnly.leads)}
                </td>
                <td className="py-3 pl-2 text-center tabular-nums font-semibold text-foreground">
                  {formatIntegerThousands(detailGrandTotal)}
                </td>
              </tr>
              {detailTableRows.map((row) => {
                const leads =
                  row.counts.click_whatsapp + row.counts.submit_lead;
                const isConsultaGeneral =
                  row.carLabel === CONSULTA_GENERAL_LABEL;
                return (
                  <tr
                    key={
                      row.carId ??
                      `agg-${row.carLabel}`.replace(/\s+/g, "-")
                    }
                    className="border-b border-border/50 text-foreground/90 last:border-0"
                  >
                    <td className="py-3 pr-4 text-left">
                      {isConsultaGeneral
                        ? `WA · ${row.carLabel}`
                        : row.carLabel}
                    </td>
                    <td className="py-3 px-2 text-center tabular-nums">
                      {row.counts.click_whatsapp}
                    </td>
                    <td className="py-3 px-2 text-center tabular-nums">
                      {detailColHideZero(row.counts.view_car)}
                    </td>
                    <td className="py-3 px-2 text-center tabular-nums">
                      {isConsultaGeneral
                        ? ""
                        : detailColHideZero(row.counts.submit_lead)}
                    </td>
                    <td className="py-3 px-2 text-center tabular-nums">
                      {isConsultaGeneral ? "" : detailColHideZero(leads)}
                    </td>
                    <td className="py-3 pl-2 text-center tabular-nums font-semibold text-foreground">
                      {isConsultaGeneral
                        ? consultaGeneralDisplayedTotal(row)
                        : row.total}
                    </td>
                  </tr>
                );
              })}
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
  glowHover,
  pulseKey,
  footer,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  borderAccent: string;
  iconAccent: string;
  glow: string;
  glowHover: string;
  pulseKey: number;
  footer?: React.ReactNode;
}) {
  return (
    <Card
      className={`relative z-0 min-w-0 overflow-hidden border bg-gradient-to-br transition-[transform,box-shadow,filter] duration-200 ease-out will-change-transform hover:z-10 hover:-translate-y-1 hover:brightness-[1.03] ${glow} ${glowHover} ${borderAccent} ${accent}`}
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
        {footer != null ? (
          <div className="mt-4 border-t border-white/15 pt-3">{footer}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
