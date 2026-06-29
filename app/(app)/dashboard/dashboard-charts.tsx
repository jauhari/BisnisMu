"use client";

import dynamic from "next/dynamic";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";

const RevenueTrendChart = dynamic(
  () => import("@/components/charts/financial-charts").then((m) => ({ default: m.RevenueTrendChart })),
  { loading: () => <GlassSkeleton className="h-80" />, ssr: false }
);

const ActivityBarChart = dynamic(
  () => import("@/components/charts/financial-charts").then((m) => ({ default: m.ActivityBarChart })),
  { loading: () => <GlassSkeleton className="h-80" />, ssr: false }
);

export function DashboardCharts({
  salesTrend,
  cashTrend,
}: {
  salesTrend: any[];
  cashTrend: any[];
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <RevenueTrendChart data={salesTrend} title="Sales trend" />
      <ActivityBarChart data={cashTrend} title="Cash movement" />
    </section>
  );
}
