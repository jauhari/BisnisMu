"use client";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { useSessionContext } from "@/components/layout/session-context";
import { GlassTable } from "@/components/tables/glass-table";
import { useOperationalReport } from "@/presentation/query/dashboard-hooks";
import { useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah, formatNumber } from "@/presentation/format/number";
// Label tampilan untuk enum FloatTransactionType; kode yang tidak dikenal ditampilkan apa adanya.
const FLOAT_TYPE_LABELS: Record<string, string> = { TOPUP: "Isi Saldo", CONSUME: "Pemakaian", TRANSFER: "Transfer Saldo", ADJUSTMENT: "Penyesuaian" };
export default function Page() {
  const { activeBusiness: biz } = useSessionContext();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useOperationalReport<any>("/api/reports/float", "float", biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn));
  if (!biz) return <GlassErrorState title="Pilih usaha dulu" description="Pilih usaha yang aktif di bagian atas halaman untuk melihat laporan ini." />;
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Laporan Saldo Rekanan tidak tersedia" description="Tidak dapat memuat laporan saldo rekanan." />;
  const report = data.data;
  return <ReportWorkspace title="Laporan Saldo Rekanan" startsOn={startsOn} endsOn={endsOn} onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn} activePreset={activePreset} onPresetChange={setActivePreset}><section className="grid gap-4 md:grid-cols-4"><GlassStatsCard title="Akun" value={formatNumber(report.accountCount ?? 0)} detail="Aktif" /><GlassStatsCard title="Saldo" value={formatRupiah(report.currentBalance ?? 0)} detail="Saat ini" /><GlassStatsCard title="Isi Saldo" value={formatRupiah(report.transactionAmountByType?.TOPUP ?? 0)} detail="Dalam periode" /><GlassStatsCard title="Saldo Tercatat Terakhir" value={formatRupiah(report.latestSnapshotBalance ?? 0)} detail="Terbaru" /></section><GlassTable tableId="report-float" columns={[{ key: "type", header: "Tipe Transaksi" }, { key: "amount", header: "Jumlah" }]} rows={Object.keys(report.transactionAmountByType ?? {}).map((type) => ({ type: FLOAT_TYPE_LABELS[type] ?? type, amount: formatRupiah(report.transactionAmountByType[type] ?? 0) }))} empty="Tidak ada data saldo rekanan." /></ReportWorkspace>;
}
