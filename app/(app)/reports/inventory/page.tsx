"use client";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { useSessionContext } from "@/components/layout/session-context";
import { GlassTable } from "@/components/tables/glass-table";
import { useOperationalReport } from "@/presentation/query/dashboard-hooks";
import { useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah, formatNumber } from "@/presentation/format/number";
// Label tampilan untuk enum InventoryMovementType; kode yang tidak dikenal ditampilkan apa adanya.
const MOVEMENT_TYPE_LABELS: Record<string, string> = { STOCK_IN: "Stok Masuk", STOCK_OUT: "Stok Keluar", ADJUSTMENT: "Penyesuaian", TRANSFER: "Pindah Stok", SALE: "Penjualan", PURCHASE: "Pembelian", DIGITAL_CONSUMPTION: "Pemakaian Produk Digital" };
export default function Page() {
  const { activeBusiness: biz } = useSessionContext();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useOperationalReport<any>("/api/reports/inventory", "inventory", biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn));
  if (!biz) return <GlassErrorState title="Pilih usaha dulu" description="Pilih usaha yang aktif di bagian atas halaman untuk melihat laporan ini." />;
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Laporan Stok tidak tersedia" description="Tidak dapat memuat laporan stok." />;
  const report = data.data;
  return <ReportWorkspace title="Laporan Stok" startsOn={startsOn} endsOn={endsOn} onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn} activePreset={activePreset} onPresetChange={setActivePreset}><section className="grid gap-4 md:grid-cols-4"><GlassStatsCard title="Produk" value={formatNumber(report.productCount ?? 0)} detail="Terlacak" /><GlassStatsCard title="Nilai Stok" value={formatRupiah(report.inventoryValue ?? 0)} detail="Saldo" /><GlassStatsCard title="Jumlah Stok" value={formatNumber(report.balanceQuantity ?? 0)} detail="Unit" /><GlassStatsCard title="Stok Keluar" value={formatNumber(report.movementQuantityByType?.STOCK_OUT ?? 0)} detail="Mutasi" /></section><GlassTable tableId="report-inventory" columns={[{ key: "type", header: "Tipe Mutasi" }, { key: "qty", header: "Kuantitas" }, { key: "cost", header: "Biaya" }]} rows={Object.keys(report.movementQuantityByType ?? {}).map((type) => ({ type: MOVEMENT_TYPE_LABELS[type] ?? type, qty: formatNumber(report.movementQuantityByType[type] ?? 0), cost: formatRupiah(report.movementCostByType?.[type] ?? 0) }))} empty="Tidak ada data mutasi stok." /></ReportWorkspace>;
}
