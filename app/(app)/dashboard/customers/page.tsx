"use client";

import { ActivityBarChart, RevenueTrendChart } from "@/components/charts/financial-charts";
import { DashboardGrid, KpiGrid, RealtimeStatus } from "@/components/charts/dashboard-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/presentation/api/client";

const now = new Date();
const startsOn = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
const endsOn = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

function useDashboard() {
  return useQuery({ queryKey: ["dashboard", "customers"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Analytics unavailable" description="Unable to load customer analytics." />;
  const overview = data.data;
  const trend = overview.customer?.topCustomers?.map((c: any) => ({ label: c.name?.slice(0, 8) ?? c.id, value: Number(c.amount) })) ?? [];
  return <DashboardGrid><section className="flex items-end justify-between"><div><p className="text-sm font-medium text-accent">Dashboard</p><h1 className="mt-2 text-3xl font-semibold">Customer Analytics</h1><p className="mt-2 text-sm text-muted">Live customer data from DashboardService.</p></div><RealtimeStatus /></section><KpiGrid items={[{ title: "Active customers", value: String(overview.customer?.activeCustomers ?? 0), detail: "Total active" }, { title: "Deposit balance", value: String(overview.customer?.customerDepositBalance ?? 0), detail: "Customer wallets" }, { title: "Receivable", value: String(overview.receivable?.totalReceivable ?? 0), detail: "Outstanding" }, { title: "Overdue", value: String(overview.receivable?.overdueReceivable ?? 0), detail: "Past due" }]} /><section className="grid gap-6 xl:grid-cols-2"><RevenueTrendChart data={trend} title="Top customers" /><ActivityBarChart data={trend} title="Revenue by customer" /></section><GlassTable columns={[{ key: "metric", header: "Metric" }, { key: "value", header: "Value" }, { key: "detail", header: "Detail" }]} rows={[{ metric: "Net profit", value: String(overview.profitability?.netProfit ?? 0), detail: "Current period" }, { metric: "Payable", value: String(overview.payable?.totalPayable ?? 0), detail: "Outstanding" }, { metric: "Inventory", value: String(overview.inventory?.inventoryValue ?? 0), detail: "Stock value" }]} /></DashboardGrid>;
}
