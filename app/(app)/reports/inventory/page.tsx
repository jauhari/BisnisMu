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
  const { data, isLoading, error } = useOperationalReport<any>("/api/reports/inventory", "inventory", biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn));
  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Laporan Stok tidak tersedia" description="Tidak dapat memuat laporan stok." />;
  const report = data.data;
  return <ReportWorkspace title="Laporan Stok" startsOn={startsOn} endsOn={endsOn} onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn}><section className="grid gap-4 md:grid-cols-4"><GlassStatsCard title="Produk" value={formatNumber(report.productCount ?? 0)} detail="Terlacak" /><GlassStatsCard title="Nilai Stok" value={formatRupiah(report.inventoryValue ?? 0)} detail="Saldo" /><GlassStatsCard title="Qty Saldo" value={formatNumber(report.balanceQuantity ?? 0)} detail="Unit" /><GlassStatsCard title="Stok Keluar" value={formatNumber(report.movementQuantityByType?.STOCK_OUT ?? 0)} detail="Mutasi" /></section><GlassTable tableId="report-inventory" columns={[{ key: "type", header: "Tipe Mutasi" }, { key: "qty", header: "Kuantitas" }, { key: "cost", header: "Biaya" }]} rows={Object.keys(report.movementQuantityByType ?? {}).map((type) => ({ type, qty: formatNumber(report.movementQuantityByType[type] ?? 0), cost: formatRupiah(report.movementCostByType?.[type] ?? 0) }))} empty="Tidak ada data mutasi stok." /></ReportWorkspace>;
}
