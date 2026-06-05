"use client";

import { useState } from "react";
import { ActivityBarChart, RevenueTrendChart } from "@/components/charts/financial-charts";
import { DashboardGrid, DashboardExceptionPanel, KpiGrid, RealtimeStatus } from "@/components/charts/dashboard-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/presentation/api/client";
import { formatMoney, formatNumber } from "@/presentation/format/number";

type FilterOption = "1w" | "1m" | "3m" | "6m" | "1y";

function getDateRange(filter: FilterOption) {
  const endsOn = new Date();
  endsOn.setHours(23, 59, 59, 999);
  
  const startsOn = new Date();
  startsOn.setHours(0, 0, 0, 0);

  if (filter === "1w") {
    startsOn.setDate(endsOn.getDate() - 7);
  } else if (filter === "1m") {
    startsOn.setMonth(endsOn.getMonth() - 1);
  } else if (filter === "3m") {
    startsOn.setMonth(endsOn.getMonth() - 3);
  } else if (filter === "6m") {
    startsOn.setMonth(endsOn.getMonth() - 6);
  } else if (filter === "1y") {
    startsOn.setFullYear(endsOn.getFullYear() - 1);
  }
  
  return {
    startsOn: startsOn.toISOString(),
    endsOn: endsOn.toISOString(),
  };
}

function useDashboard(startsOn: string, endsOn: string) {
  return useQuery({
    queryKey: ["dashboard", "overview", startsOn, endsOn],
    queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", {
      method: "POST",
      body: JSON.stringify({ startsOn, endsOn })
    })
  });
}

export default function Page() {
  const [filter, setFilter] = useState<FilterOption>("1m");
  const { startsOn, endsOn } = getDateRange(filter);
  const { data, isLoading, error } = useDashboard(startsOn, endsOn);

  if (isLoading) return <div className="grid gap-4"><GlassSkeleton className="h-28" /><GlassSkeleton className="h-72" /></div>;
  if (error || !data) return <GlassErrorState title="Dashboard unavailable" description="Unable to load dashboard overview." />;

  const overview = data.data;
  const salesTrend = overview.salesTrend ?? [];
  const cashTrend = overview.cashTrend ?? [];

  return <DashboardGrid>
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-medium text-accent">Executive cockpit</p>
        <h1 className="mt-2 text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-muted">Realtime analytics backed by DashboardService projections.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-white/50 p-1 backdrop-blur-sm border border-border/40 dark:bg-white/5">
          {(["1w", "1m", "3m", "6m", "1y"] as const).map((opt) => {
            const labelMap: Record<FilterOption, string> = {
              "1w": "1 Minggu",
              "1m": "1 Bulan",
              "3m": "3 Bulan",
              "6m": "6 Bulan",
              "1y": "1 Tahun"
            };
            const active = filter === opt;
            return (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-accent text-background shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {labelMap[opt]}
              </button>
            );
          })}
        </div>
        <RealtimeStatus />
      </div>
    </section>

    <KpiGrid items={[
      { title: "Sales today", value: formatMoney(overview.sales?.salesToday ?? 0), detail: "Live" },
      { title: "Net profit", value: formatMoney(overview.profitability?.netProfit ?? 0), detail: `Margin ${overview.profitability?.profitMargin ?? 0}%` },
      { title: "Cash + bank", value: formatMoney(Number(overview.cash?.cashOnHand ?? 0) + Number(overview.cash?.bankBalance ?? 0)), detail: "Available balance" },
      { title: "Inventory value", value: formatMoney(overview.inventory?.inventoryValue ?? 0), detail: `${overview.inventory?.lowStockItems?.length ?? 0} low stock alerts` }
    ]} />

    <section className="grid gap-6 xl:grid-cols-2">
      <RevenueTrendChart data={salesTrend} title="Sales trend" />
      <ActivityBarChart data={cashTrend} title="Cash movement" />
    </section>

    <DashboardExceptionPanel>
      <GlassTable
        columns={[{ key: "item", header: "Exception" }, { key: "value", header: "Value" }, { key: "action", header: "Action" }]}
        rows={[
          { item: "Overdue receivable", value: formatMoney(overview.receivable?.overdueReceivable ?? 0), action: "Review AR" },
          { item: "Low stock", value: formatNumber(overview.inventory?.lowStockItems?.length ?? 0), action: "Review inventory" },
          { item: "Low float", value: overview.float?.lowFloatProviders?.[0]?.provider ?? "None", action: "Top up" }
        ]}
      />
    </DashboardExceptionPanel>
  </DashboardGrid>;
}

