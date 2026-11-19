"use client";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { useSessionContext } from "@/components/layout/session-context";
import { GlassTable } from "@/components/tables/glass-table";
import { useOperationalReport } from "@/presentation/query/dashboard-hooks";
import { useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah, formatNumber } from "@/presentation/format/number";
// Label tampilan untuk enum SalesOrderStatus; kode yang tidak dikenal ditampilkan apa adanya.
const SALES_STATUS_LABELS: Record<string, string> = { DRAFT: "Draf", CONFIRMED: "Dikonfirmasi", PARTIALLY_PAID: "Dibayar sebagian", PAID: "Lunas", VOID: "Dibatalkan" };
export default function Page() {
  const { activeBusiness: biz } = useSessionContext();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useOperationalReport<any>("/api/reports/sales", "sales", biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn));
  if (!biz) return <GlassErrorState title="Pilih usaha dulu" description="Pilih usaha yang aktif di bagian atas halaman untuk melihat laporan ini." />;
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Laporan Penjualan tidak tersedia" description="Tidak dapat memuat laporan penjualan." />;
  const report = data.data;
  return <ReportWorkspace title="Laporan Penjualan" startsOn={startsOn} endsOn={endsOn} onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn} activePreset={activePreset} onPresetChange={setActivePreset}><section className="grid gap-4 md:grid-cols-4"><GlassStatsCard title="Pesanan" value={formatNumber(report.orderCount ?? 0)} detail="Dalam periode" /><GlassStatsCard title="Item Terjual" value={formatNumber(report.itemCount ?? 0)} detail="Terjual" /><GlassStatsCard title="Total" value={formatRupiah(report.totalAmount ?? 0)} detail="Bruto" /><GlassStatsCard title="Belum Bayar" value={formatRupiah(report.outstandingAmount ?? 0)} detail="Belum lunas" /></section><GlassTable tableId="report-sales" columns={[{ key: "status", header: "Status" }, { key: "count", header: "Jumlah" }, { key: "total", header: "Total" }]} rows={Object.entries(report.byStatus ?? {}).map(([status, row]: any) => ({ status: SALES_STATUS_LABELS[status] ?? status, count: formatNumber(row.count ?? 0), total: formatRupiah(row.totalAmount ?? 0) }))} empty="Tidak ada data penjualan." /></ReportWorkspace>;
}
