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
  const { startsOn, endsOn, setStartsOn, setEndsOn } = useReportRange();
  const { data, isLoading, error } = useOperationalReport<any>("/api/reports/sales", "sales", biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn));
  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Laporan Penjualan tidak tersedia" description="Tidak dapat memuat laporan penjualan." />;
  const report = data.data;
  return <ReportWorkspace title="Laporan Penjualan" startsOn={startsOn} endsOn={endsOn} onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn}><section className="grid gap-4 md:grid-cols-4"><GlassStatsCard title="Pesanan" value={formatNumber(report.orderCount ?? 0)} detail="Dalam periode" /><GlassStatsCard title="Item Terjual" value={formatNumber(report.itemCount ?? 0)} detail="Terjual" /><GlassStatsCard title="Total" value={formatRupiah(report.totalAmount ?? 0)} detail="Bruto" /><GlassStatsCard title="Belum Bayar" value={formatRupiah(report.outstandingAmount ?? 0)} detail="Belum lunas" /></section><GlassTable tableId="report-sales" columns={[{ key: "status", header: "Status" }, { key: "count", header: "Jumlah" }, { key: "total", header: "Total" }]} rows={Object.entries(report.byStatus ?? {}).map(([status, row]: any) => ({ status, count: formatNumber(row.count ?? 0), total: formatRupiah(row.totalAmount ?? 0) }))} empty="Tidak ada data penjualan." /></ReportWorkspace>;
}
