"use client";
import { RevenueTrendChart } from "@/components/charts/financial-charts";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useProfitLossReport } from "@/presentation/query/dashboard-hooks";
const request = { command: { businessId: "demo-biz", actorUserId: "demo-user", startsOn: new Date("2026-05-01T00:00:00.000Z"), endsOn: new Date("2026-05-31T23:59:59.999Z") } };
const trend = [{ label: "W1", value: 1200000 }, { label: "W2", value: 1800000 }, { label: "W3", value: 1450000 }, { label: "W4", value: 2200000 }];
export default function Page() { const { data, isLoading, error } = useProfitLossReport(request); if (isLoading) return <GlassSkeleton className="h-72" />; if (error || !data) return <GlassErrorState title="Profit & Loss unavailable" description="Unable to load profit and loss." />; const report = data.data; return <ReportWorkspace title="Profit & Loss"><section className="grid gap-4 md:grid-cols-3"><GlassStatsCard title="Revenue" value={report.revenue.total.toString()} detail="Revenue accounts" /><GlassStatsCard title="Gross profit" value={report.grossProfit.toString()} detail="Revenue - COGS" /><GlassStatsCard title="Net profit" value={report.netIncome.toString()} detail="After expenses" /></section><RevenueTrendChart data={trend} title="Profit trend" /><GlassTable columns={[{ key: "section", header: "Section" }, { key: "amount", header: "Amount" }]} rows={[{ section: "Revenue", amount: report.revenue.total.toString() }, { section: "COGS", amount: report.cogs.total.toString() }, { section: "Expenses", amount: report.expenses.total.toString() }, { section: "Other expenses", amount: report.otherExpenses.total.toString() }]} /></ReportWorkspace>; }
