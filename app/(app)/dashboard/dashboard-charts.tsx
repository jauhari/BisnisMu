"use client";

import { ActivityBarChart, RevenueTrendChart } from "@/components/charts/financial-charts";

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
