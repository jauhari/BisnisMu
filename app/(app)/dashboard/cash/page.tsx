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
  return useQuery({ queryKey: ["dashboard", "cash"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Analytics unavailable" description="Unable to load cash analytics." />;
  const overview = data.data;
  const trend = [{ label: "Cash", value: Number(overview.cash?.cashOnHand ?? 0) }, { label: "Bank", value: Number(overview.cash?.bankBalance ?? 0) }, { label: "Flow", value: Number(overview.cash?.cashFlowToday ?? 0) }];
  return <DashboardGrid><section className="flex items-end justify-between"><div><p className="text-sm font-medium text-accent">Dashboard</p><h1 className="mt-2 text-3xl font-semibold">Cash Analytics</h1><p className="mt-2 text-sm text-muted">Live cash data from DashboardService.</p></div><RealtimeStatus /></section><KpiGrid items={[{ title: "Cash on hand", value: String(overview.cash?.cashOnHand ?? 0), detail: "Physical cash" }, { title: "Bank balance", value: String(overview.cash?.bankBalance ?? 0), detail: "Bank accounts" }, { title: "Cash flow today", value: String(overview.cash?.cashFlowToday ?? 0), detail: "Net movement" }, { title: "Total float", value: String(overview.float?.totalFloatBalance ?? 0), detail: "Provider float" }]} /><section className="grid gap-6 xl:grid-cols-2"><RevenueTrendChart data={trend} title="Cash position" /><ActivityBarChart data={trend} title="Balances" /></section><GlassTable columns={[{ key: "metric", header: "Metric" }, { key: "value", header: "Value" }, { key: "detail", header: "Detail" }]} rows={[{ metric: "Receivable", value: String(overview.receivable?.totalReceivable ?? 0), detail: "Outstanding" }, { metric: "Payable", value: String(overview.payable?.totalPayable ?? 0), detail: "Outstanding" }, { metric: "Net profit", value: String(overview.profitability?.netProfit ?? 0), detail: "Current period" }]} /></DashboardGrid>;
}
