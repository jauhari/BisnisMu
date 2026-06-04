"use client";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useOperationalReport } from "@/presentation/query/dashboard-hooks";
import { useActiveBusiness, useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah, formatNumber } from "@/presentation/format/number";
export default function Page() {
  const { data: biz, isLoading: bizLoading } = useActiveBusiness();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useOperationalReport<any>("/api/reports/purchase", "purchase", biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn));
  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Laporan Pembelian tidak tersedia" description="Tidak dapat memuat laporan pembelian." />;
  const report = data.data;
  return <ReportWorkspace title="Laporan Pembelian" startsOn={startsOn} endsOn={endsOn} onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn} activePreset={activePreset} onPresetChange={setActivePreset}><section className="grid gap-4 md:grid-cols-4"><GlassStatsCard title="Pesanan" value={formatNumber(report.orderCount ?? 0)} detail="Dalam periode" /><GlassStatsCard title="Penerimaan" value={formatNumber(report.receiptCount ?? 0)} detail="Diterima" /><GlassStatsCard title="Neto Diterima" value={formatRupiah(report.netReceivedCost ?? 0)} detail="Setelah retur" /><GlassStatsCard title="Total Dipesan" value={formatRupiah(report.orderedAmount ?? 0)} detail="Pengadaan" /></section><GlassTable tableId="report-purchase" columns={[{ key: "metric", header: "Metrik" }, { key: "value", header: "Nilai" }]} rows={[{ metric: "Total Dipesan", value: formatRupiah(report.orderedAmount ?? 0) }, { metric: "Biaya Diterima", value: formatRupiah(report.receivedCost ?? 0) }, { metric: "Biaya Retur", value: formatRupiah(report.returnedCost ?? 0) }]} empty="Tidak ada data pembelian." /></ReportWorkspace>;
}
