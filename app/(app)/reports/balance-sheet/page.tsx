"use client";

import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassPanel, GlassStatsCard } from "@/components/glass/glass-primitives";
import { useSessionContext } from "@/components/layout/session-context";
import { useBalanceSheetReport } from "@/presentation/query/dashboard-hooks";
import { useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatDateLong, formatNumber, formatRupiah } from "@/presentation/format/number";
import { exportBalanceSheetPdf, exportBalanceSheetExcel } from "@/presentation/export/report-exports";

const n = (v: any) => Number(v ?? 0);

interface Line { name: string; amount: number }

// Format akuntansi: "Rp" rata kiri, angka rata kanan dalam lebar tetap supaya
// digit sejajar antarbaris; negatif (mis. akumulasi penyusutan) dalam kurung.
function Money({ value, className = "" }: { value: number; className?: string }) {
  const digits = formatNumber(Math.abs(Math.round(value)));
  return (
    <span className={`inline-flex w-36 shrink-0 sm:w-44 justify-between tabular-nums ${className}`}>
      <span>Rp</span>
      <span>{value < 0 ? `(${digits})` : `${digits}\u2007`}</span>
    </span>
  );
}

function StatementSection({ title, lines, total, totalLabel }: { title: string; lines: Line[]; total: number; totalLabel?: string }) {
  return (
    <section className="px-4 py-5 sm:px-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Tidak ada saldo.</p>
      ) : (
        <dl className="mt-3 divide-y divide-border/40">
          {lines.map((l) => (
            <div key={l.name} className="flex items-baseline justify-between gap-3 py-2.5 text-sm sm:gap-6">
              <dt className="pl-2 sm:pl-3">{l.name}</dt>
              <dd><Money value={l.amount} className={l.amount < 0 ? "text-muted" : ""} /></dd>
            </div>
          ))}
        </dl>
      )}
      {totalLabel ? (
        <div className="mt-1 flex items-baseline justify-between gap-6 border-t border-border pt-3 text-sm font-semibold">
          <span>{totalLabel}</span>
          <Money value={total} />
        </div>
      ) : null}
    </section>
  );
}

function GrandTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="mt-auto flex items-baseline justify-between gap-6 border-t-2 border-foreground/80 bg-foreground/[0.03] px-4 py-4 font-semibold sm:px-6">
      <span>{label}</span>
      <Money value={amount} />
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
        <div className="border-b border-border/60 px-4 py-4 text-sm text-muted sm:px-6">
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
