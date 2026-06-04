"use client";
import { ActivityBarChart } from "@/components/charts/financial-charts";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useCashFlowReport } from "@/presentation/query/dashboard-hooks";
import { useActiveBusiness, useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah } from "@/presentation/format/number";
export default function Page() {
  const { data: biz, isLoading: bizLoading } = useActiveBusiness();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useCashFlowReport(biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn));
  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Arus Kas tidak tersedia" description="Tidak dapat memuat laporan arus kas." />;
  const report = data.data;
  const trend = [
    { label: "Operasional", value: Number(report.operatingActivities?.total ?? 0) },
    { label: "Investasi", value: Number(report.investingActivities?.total ?? 0) },
    { label: "Pendanaan", value: Number(report.financingActivities?.total ?? 0) },
  ];
  return <ReportWorkspace title="Arus Kas" startsOn={startsOn} endsOn={endsOn} onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn} activePreset={activePreset} onPresetChange={setActivePreset}><section className="grid gap-4 md:grid-cols-4"><GlassStatsCard title="Saldo Awal" value={formatRupiah(report.beginningCashBalance ?? 0)} detail="Sebelum periode" /><GlassStatsCard title="Operasional" value={formatRupiah(report.operatingActivities?.total ?? 0)} detail="Neto" /><GlassStatsCard title="Pendanaan" value={formatRupiah(report.financingActivities?.total ?? 0)} detail="Neto" /><GlassStatsCard title="Saldo Akhir" value={formatRupiah(report.endingCashBalance ?? 0)} detail="Kas + bank" /></section><ActivityBarChart data={trend} title="Pergerakan kas per aktivitas" /><GlassTable tableId="report-cash-flow" columns={[{ key: "activity", header: "Aktivitas" }, { key: "account", header: "Akun" }, { key: "amount", header: "Jumlah" }]} rows={[...(report.operatingActivities?.lines ?? []), ...(report.investingActivities?.lines ?? []), ...(report.financingActivities?.lines ?? [])].map((line: any) => ({ activity: line.activity, account: line.accountName, amount: formatRupiah(line.amount ?? 0) }))} empty="Tidak ada data arus kas." /></ReportWorkspace>;
}
