"use client";

import { ActivityBarChart, RevenueTrendChart } from "@/components/charts/financial-charts";
import { DashboardGrid, KpiGrid, RealtimeStatus } from "@/components/charts/dashboard-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/presentation/api/client";

function useDashboard() {
  const now = new Date();
  const startsOn = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endsOn = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return useQuery({ queryKey: ["dashboard", "sales"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Analytics unavailable" description="Unable to load sales analytics." />;
  const overview = data.data;
  const trend = overview.sales?.topProducts?.map((p: any) => ({ label: p.name?.slice(0, 8) ?? p.id, value: Number(p.amount) })) ?? [];
  return <DashboardGrid><section className="flex items-end justify-between"><div><p className="text-sm font-medium text-accent">Dashboard</p><h1 className="mt-2 text-3xl font-semibold">Sales Analytics</h1><p className="mt-2 text-sm text-muted">Live sales data from DashboardService.</p></div><RealtimeStatus /></section><KpiGrid items={[{ title: "Sales this month", value: String(overview.sales?.salesThisMonth ?? 0), detail: "Monthly sales" }, { title: "Cash on hand", value: String(overview.cash?.cashOnHand ?? 0), detail: "Cash only" }, { title: "Inventory value", value: String(overview.inventory?.inventoryValue ?? 0), detail: "Stock value" }, { title: "Total float", value: String(overview.float?.totalFloatBalance ?? 0), detail: "Provider float" }]} /><section className="grid gap-6 xl:grid-cols-2"><RevenueTrendChart data={trend} title="Top products" /><ActivityBarChart data={trend} title="Revenue by product" /></section><GlassTable columns={[{ key: "metric", header: "Metric" }, { key: "value", header: "Value" }, { key: "detail", header: "Detail" }]} rows={[{ metric: "Receivable", value: String(overview.receivable?.totalReceivable ?? 0), detail: "Outstanding" }, { metric: "Payable", value: String(overview.payable?.totalPayable ?? 0), detail: "Outstanding" }, { metric: "Net profit", value: String(overview.profitability?.netProfit ?? 0), detail: "Current period" }]} /></DashboardGrid>;
}
