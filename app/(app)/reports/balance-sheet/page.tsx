"use client";

import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useBalanceSheetReport } from "@/presentation/query/dashboard-hooks";
import { useActiveBusiness, useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { exportBalanceSheetPdf, exportBalanceSheetExcel } from "@/presentation/export/report-exports";

const n = (v: any) => Number(v ?? 0);

export default function Page() {
  const { data: biz, isLoading: bizLoading } = useActiveBusiness();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useBalanceSheetReport(
    biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn)
  );

  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Neraca tidak tersedia" description="Tidak dapat memuat neraca." />;

  const report = data.data;
  const totalAssets = n(report.totalAssets);
  const totalLiabEq = n(report.totalLiabilitiesAndEquity);
  const balanced = Math.abs(totalAssets - totalLiabEq) < 1;

  const assetLines: any[] = report.assets?.lines ?? [];
  const liabLines: any[] = report.liabilities?.lines ?? [];
  const equityLines: any[] = report.equity?.lines ?? [];
  const currentEarnings = n(report.currentPeriodEarnings?.amount);

  const rows = [
    { section: "ASET", account: "", amount: "" },
    ...assetLines.map((l: any) => ({ section: "", account: `  ${l.accountName}`, amount: formatRupiah(n(l.amount)) })),
    { section: "", account: "Total Aset", amount: formatRupiah(totalAssets) },
    { section: "", account: "", amount: "" },
    { section: "LIABILITAS", account: "", amount: "" },
    ...liabLines.map((l: any) => ({ section: "", account: `  ${l.accountName}`, amount: formatRupiah(n(l.amount)) })),
    ...(liabLines.length > 0 ? [{ section: "", account: "Total Liabilitas", amount: formatRupiah(liabLines.reduce((s, l) => s + n(l.amount), 0)) }] : []),
    { section: "", account: "", amount: "" },
    { section: "EKUITAS", account: "", amount: "" },
    ...equityLines.map((l: any) => ({ section: "", account: `  ${l.accountName}`, amount: formatRupiah(n(l.amount)) })),
    ...(currentEarnings !== 0 ? [{ section: "", account: "  Laba Periode Berjalan", amount: formatRupiah(currentEarnings) }] : []),
    { section: "", account: "Total Ekuitas", amount: formatRupiah(equityLines.reduce((s, l) => s + n(l.amount), 0) + currentEarnings) },
    { section: "", account: "", amount: "" },
    { section: "", account: "Total Liabilitas & Ekuitas", amount: formatRupiah(totalLiabEq) },
  ];

  return (
    <ReportWorkspace
      title="Neraca"
      startsOn={startsOn} endsOn={endsOn}
      onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn} activePreset={activePreset} onPresetChange={setActivePreset}
      onExportPdf={() => exportBalanceSheetPdf(report, biz.name, startsOn, endsOn)}
      onExportExcel={() => exportBalanceSheetExcel(report, biz.name, startsOn, endsOn)}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <GlassStatsCard title="Total Aset" value={formatRupiah(totalAssets)} detail={`${assetLines.length} pos aset`} />
        <GlassStatsCard title="Total Liabilitas" value={formatRupiah(liabLines.reduce((s, l) => s + n(l.amount), 0))} detail={`${liabLines.length} pos utang`} />
        <GlassStatsCard title="Total Ekuitas" value={formatRupiah(equityLines.reduce((s, l) => s + n(l.amount), 0) + currentEarnings)} detail="Termasuk laba periode ini" />
        <GlassStatsCard
          title="Keseimbangan"
          value={balanced ? "✓ Seimbang" : "⚠ Tidak Seimbang"}
          detail={balanced ? "Aset = Liabilitas + Ekuitas" : `Selisih ${formatRupiah(Math.abs(totalAssets - totalLiabEq))}`}
          className={balanced ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}
        />
      </section>

      {!balanced && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          ⚠ Neraca <strong>tidak seimbang</strong> — selisih {formatRupiah(Math.abs(totalAssets - totalLiabEq))}. Kemungkinan ada jurnal yang belum lengkap.
        </div>
      )}

      <GlassTable
        tableId="report-balance-sheet"
        columns={[
          { key: "section", header: "Kelompok" },
          { key: "account", header: "Akun" },
          { key: "amount", header: "Jumlah (Rp)" },
        ]}
        rows={rows}
        empty="Tidak ada data neraca."
      />
    </ReportWorkspace>
  );
}
