"use client";

import dynamic from "next/dynamic";

const DashboardClient = dynamic(
  () =>
    import("@/components/dashboard/DashboardClient").then((m) => ({
      default: m.DashboardClient,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-8">
        <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="h-80 rounded-2xl bg-white/[0.04] lg:col-span-3" />
          <div className="h-80 rounded-2xl bg-white/[0.04] lg:col-span-2" />
        </div>
      </div>
    ),
  },
);

export function DashboardDynamic() {
  return <DashboardClient />;
}
