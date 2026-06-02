"use client";

import { ActivityBarChart, RevenueTrendChart } from "@/components/charts/financial-charts";
import { DashboardGrid, DashboardExceptionPanel, KpiGrid, RealtimeStatus } from "@/components/charts/dashboard-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/presentation/api/client";

const now = new Date();
const startsOn = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
const endsOn = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

function useDashboard() {
  return useQuery({ queryKey: ["dashboard", "overview"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <div className="grid gap-4"><GlassSkeleton className="h-28" /><GlassSkeleton className="h-72" /></div>;
  if (error || !data) return <GlassErrorState title="Dashboard unavailable" description="Unable to load dashboard overview." />;
  const overview = data.data;
  const trend = [
    { label: "Mon", value: Number(overview.cash?.cashFlowToday ?? 0) },
    { label: "Tue", value: Number(overview.sales?.salesToday ?? 0) },
    { label: "Wed", value: Number(overview.profitability?.grossProfit ?? 0) },
    { label: "Thu", value: Number(overview.profitability?.netProfit ?? 0) },
    { label: "Fri", value: Number(overview.receivable?.totalReceivable ?? 0) },
    { label: "Sat", value: Number(overview.payable?.totalPayable ?? 0) },
    { label: "Sun", value: Number(overview.inventory?.inventoryValue ?? 0) }
  ];
  return <DashboardGrid>
    <section className="flex items-end justify-between"><div><p className="text-sm font-medium text-accent">Executive cockpit</p><h1 className="mt-2 text-3xl font-semibold">Dashboard</h1><p className="mt-2 text-sm text-muted">Realtime analytics backed by DashboardService projections.</p></div><RealtimeStatus /></section>
    <KpiGrid items={[{ title: "Sales today", value: String(overview.sales?.salesToday ?? 0), detail: "Live" }, { title: "Net profit", value: String(overview.profitability?.netProfit ?? 0), detail: `Margin ${overview.profitability?.profitMargin ?? 0}%` }, { title: "Cash + bank", value: String((overview.cash?.cashOnHand ?? 0n) + (overview.cash?.bankBalance ?? 0n)), detail: "Available balance" }, { title: "Inventory value", value: String(overview.inventory?.inventoryValue ?? 0), detail: `${overview.inventory?.lowStockItems?.length ?? 0} low stock alerts` }]} />
    <section className="grid gap-6 xl:grid-cols-2"><RevenueTrendChart data={trend} title="Sales trend" /><ActivityBarChart data={trend} title="Cash movement" /></section>
    <DashboardExceptionPanel><GlassTable columns={[{ key: "item", header: "Exception" }, { key: "value", header: "Value" }, { key: "action", header: "Action" }]} rows={[{ item: "Overdue receivable", value: String(overview.receivable?.overdueReceivable ?? 0), action: "Review AR" }, { item: "Low stock", value: String(overview.inventory?.lowStockItems?.length ?? 0), action: "Review inventory" }, { item: "Low float", value: overview.float?.lowFloatProviders?.[0]?.provider ?? "None", action: "Top up" }]} /></DashboardExceptionPanel>
  </DashboardGrid>;
}
