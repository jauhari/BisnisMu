"use client";

import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassPanel, GlassStatsCard } from "@/components/glass/glass-primitives";
import { useSessionContext } from "@/components/layout/session-context";
import { useBalanceSheetReport } from "@/presentation/query/dashboard-hooks";
import { useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatDateLong, formatRupiah } from "@/presentation/format/number";
import { exportBalanceSheetPdf, exportBalanceSheetExcel } from "@/presentation/export/report-exports";

const n = (v: any) => Number(v ?? 0);

interface Line { name: string; amount: number }

// Angka negatif (mis. akumulasi penyusutan) ditulis dalam kurung, konvensi laporan keuangan.
const money = (v: number): string => (v < 0 ? `(${formatRupiah(-v)})` : formatRupiah(v));

function StatementSection({ title, lines, total, totalLabel }: { title: string; lines: Line[]; total: number; totalLabel?: string }) {
  return (
    <section className="px-5 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Tidak ada saldo.</p>
      ) : (
        <dl className="mt-2 grid gap-1.5">
          {lines.map((l) => (
            <div key={l.name} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="pl-3">{l.name}</dt>
              <dd className={`whitespace-nowrap tabular-nums ${l.amount < 0 ? "text-muted" : ""}`}>{money(l.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
      {totalLabel ? (
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border/60 pt-2 text-sm font-semibold">
          <span>{totalLabel}</span>
          <span className="whitespace-nowrap tabular-nums">{money(total)}</span>
        </div>
      ) : null}
    </section>
  );
}

function GrandTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="mt-auto flex items-baseline justify-between gap-4 border-t-2 border-foreground/80 bg-foreground/[0.03] px-5 py-3 font-semibold">
      <span>{label}</span>
      <span className="whitespace-nowrap tabular-nums">{money(amount)}</span>
    </div>
  );
}

export default function Page() {
  const { activeBusiness: biz } = useSessionContext();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useBalanceSheetReport(
    biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn)
  );

  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Neraca tidak tersedia" description="Tidak dapat memuat neraca." />;

  const report = data.data;
  const totalAssets = n(report.totalAssets);
  const totalLiabEq = n(report.totalLiabilitiesAndEquity);
  const balanced = Math.abs(totalAssets - totalLiabEq) < 1;

  const assetLines: any[] = report.assets?.lines ?? [];
  const liabLines: any[] = report.liabilities?.lines ?? [];
  const equityLines: any[] = report.equity?.lines ?? [];
  const currentEarnings = n(report.currentPeriodEarnings?.amount);

  const totalLiab = liabLines.reduce((s, l) => s + n(l.amount), 0);
  const totalEquity = equityLines.reduce((s, l) => s + n(l.amount), 0) + currentEarnings;
  const equityRows: Line[] = [
    ...equityLines.map((l: any) => ({ name: l.accountName, amount: n(l.amount) })),
    ...(currentEarnings !== 0 ? [{ name: "Laba periode berjalan", amount: currentEarnings }] : []),
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
        <GlassStatsCard title="Total Liabilitas" value={formatRupiah(totalLiab)} detail={`${liabLines.length} pos utang`} />
        <GlassStatsCard title="Total Ekuitas" value={formatRupiah(totalEquity)} detail="Termasuk laba periode ini" />
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

      {/* Format neraca dua sisi (skontro): kiri harus sama dengan kanan. */}
      <GlassPanel className="p-0">
        <div className="border-b border-border/60 px-5 py-3 text-sm text-muted">
          Posisi keuangan per <span className="font-medium text-foreground">{formatDateLong(endsOn)}</span>
        </div>
        <div className="grid lg:grid-cols-2 lg:divide-x divide-border/60">
          <div className="flex flex-col">
            <StatementSection title="Aset" lines={assetLines.map((l: any) => ({ name: l.accountName, amount: n(l.amount) }))} total={totalAssets} />
            <GrandTotal label="Total Aset" amount={totalAssets} />
          </div>
          <div className="flex flex-col border-t border-border/60 lg:border-t-0">
            <StatementSection title="Liabilitas (utang)" lines={liabLines.map((l: any) => ({ name: l.accountName, amount: n(l.amount) }))} total={totalLiab} totalLabel="Total liabilitas" />
            <StatementSection title="Ekuitas (modal)" lines={equityRows} total={totalEquity} totalLabel="Total ekuitas" />
            <GrandTotal label="Total Liabilitas & Ekuitas" amount={totalLiabEq} />
          </div>
        </div>
      </GlassPanel>
    </ReportWorkspace>
  );
}
