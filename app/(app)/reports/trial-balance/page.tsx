"use client";

import { useState } from "react";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useTrialBalanceReport } from "@/presentation/query/dashboard-hooks";
import { useActiveBusiness, useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { exportTrialBalancePdf, exportTrialBalanceExcel } from "@/presentation/export/report-exports";

const n = (v: any) => Number(v ?? 0);
const hasActivity = (row: any) => n(row.debit) !== 0 || n(row.credit) !== 0;

export default function Page() {
  const { data: biz, isLoading: bizLoading } = useActiveBusiness();
  const { startsOn, endsOn, setStartsOn, setEndsOn } = useReportRange();
  const [showEmpty, setShowEmpty] = useState(false);

  const { data, isLoading, error } = useTrialBalanceReport(
    biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn)
  );

  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Neraca Saldo tidak tersedia" description="Tidak dapat memuat neraca saldo." />;

  const report = data.data;
  const allRows: any[] = report.rows ?? [];
  const activeRows = allRows.filter(hasActivity);
  const displayed = showEmpty ? allRows : activeRows;

  const selisih = n(report.totalDebit) - n(report.totalCredit);
  const balanced = Math.abs(selisih) < 1;

  const rows = displayed.map((row: any) => ({
    account: row.accountCode ? `${row.accountCode} ${row.accountName}` : row.accountName,
    debit: n(row.debit),
    credit: n(row.credit),
  }));

  return (
    <ReportWorkspace
      title="Neraca Saldo"
      startsOn={startsOn} endsOn={endsOn}
      onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn}
      onExportPdf={() => exportTrialBalancePdf(report, biz.name, startsOn, endsOn)}
      onExportExcel={() => exportTrialBalanceExcel(report, biz.name, startsOn, endsOn)}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <GlassStatsCard title="Total Debit" value={formatRupiah(n(report.totalDebit))} detail="Harus seimbang" />
        <GlassStatsCard title="Total Kredit" value={formatRupiah(n(report.totalCredit))} detail="Harus seimbang" />
        <GlassStatsCard
          title="Status"
          value={balanced ? "✓ Seimbang" : `Selisih ${formatRupiah(Math.abs(selisih))}`}
          detail={balanced ? "Debit = Kredit" : "⚠ Periksa jurnal Anda"}
          className={balanced ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}
        />
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Menampilkan <strong className="text-foreground">{displayed.length}</strong> akun
          {!showEmpty && activeRows.length < allRows.length
            ? ` (${allRows.length - activeRows.length} akun nol disembunyikan)`
            : ""}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="h-4 w-4 accent-accent" />
          Tampilkan akun nol
        </label>
      </div>

      <GlassTable
        tableId="report-trial-balance"
        columns={[
          { key: "account", header: "Akun" },
          {
            key: "debit", header: "Debit (Rp)",
            render: (row: any) => row.debit > 0
              ? <span className="tabular-nums font-medium">{formatRupiah(row.debit)}</span>
              : <span className="text-muted/40">—</span>,
          },
          {
            key: "credit", header: "Kredit (Rp)",
            render: (row: any) => row.credit > 0
              ? <span className="tabular-nums font-medium">{formatRupiah(row.credit)}</span>
              : <span className="text-muted/40">—</span>,
          },
        ]}
        rows={rows}
        empty="Tidak ada data neraca saldo."
      />
    </ReportWorkspace>
  );
}
