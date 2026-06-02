"use client";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useTrialBalanceReport } from "@/presentation/query/dashboard-hooks";
const request = { command: { businessId: "demo-biz", actorUserId: "demo-user", startsOn: new Date("2026-05-01T00:00:00.000Z"), endsOn: new Date("2026-05-31T23:59:59.999Z") } };
export default function Page() { const { data, isLoading, error } = useTrialBalanceReport(request); if (isLoading) return <GlassSkeleton className="h-72" />; if (error || !data) return <GlassErrorState title="Trial Balance unavailable" description="Unable to load trial balance." />; const report = data.data; return <ReportWorkspace title="Trial Balance"><section className="grid gap-4 md:grid-cols-3"><GlassStatsCard title="Total debit" value={report.totalDebit.toString()} detail="Balanced" /><GlassStatsCard title="Total credit" value={report.totalCredit.toString()} detail="Balanced" /><GlassStatsCard title="Difference" value={String(report.totalDebit - report.totalCredit)} detail="Should be 0" /></section><GlassTable columns={[{ key: "account", header: "Account" }, { key: "debit", header: "Debit" }, { key: "credit", header: "Credit" }]} rows={report.rows.map((row) => ({ account: row.accountName, debit: row.debit.toString(), credit: row.credit.toString() }))} /></ReportWorkspace>; }
