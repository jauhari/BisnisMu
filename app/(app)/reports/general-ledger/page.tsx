"use client";

import { useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useGeneralLedgerReport } from "@/presentation/query/dashboard-hooks";
import { useActiveBusiness, useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { exportGeneralLedgerPdf, exportGeneralLedgerExcel } from "@/presentation/export/report-exports";

function fmtDate(d: Date | string | undefined | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00Z" : "")) : d;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function fmtShort(d: string | Date | undefined | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

const n = (v: any) => Number(v ?? 0);
const hasActivity = (row: any) => n(row.openingBalance) !== 0 || n(row.periodDebit) !== 0 || n(row.periodCredit) !== 0;

function AccountDrilldown({ account, onClose }: { account: any; onClose: () => void }) {
  const entries: any[] = account.entries ?? [];
  const closing = n(account.closingBalance);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background shadow-2xl ring-1 ring-border/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/60 px-6 py-5">
          <div>
            <p className="font-mono text-xs text-muted">{account.accountCode}</p>
            <h2 className="mt-0.5 text-lg font-semibold">{account.accountName}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/60 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 divide-x divide-border/60 border-b border-border/60">
          {[
            { label: "Saldo Awal", value: n(account.openingBalance) },
            { label: "Debit", value: n(account.periodDebit) },
            { label: "Kredit", value: n(account.periodCredit) },
            { label: "Saldo Akhir", value: closing },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3">
              <p className="text-xs text-muted">{label}</p>
              <p className={`mt-0.5 text-sm font-semibold tabular-nums ${label === "Saldo Akhir" && value < 0 ? "text-danger" : ""}`}>
                {value !== 0 ? formatRupiah(value) : <span className="font-normal text-muted/50">—</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-auto">
          {entries.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted">
              Tidak ada mutasi di periode ini
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border/60 bg-background/95 backdrop-blur">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Tanggal</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Keterangan</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Debit</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Kredit</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any, i: number) => {
                  const rb = n(entry.runningBalance);
                  return (
                    <tr key={entry.journalLineId ?? i} className="border-b border-border/40 hover:bg-white/40 dark:hover:bg-white/5">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{fmtShort(entry.transactionDate)}</td>
                      <td className="px-4 py-2.5">
                        <p className="max-w-[220px] truncate">{entry.description || "—"}</p>
                        {entry.journalNumber && (
                          <p className="font-mono text-xs text-muted/60">{entry.journalNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {n(entry.debit) > 0 ? <span className="font-medium">{formatRupiah(n(entry.debit))}</span> : <span className="text-muted/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {n(entry.credit) > 0 ? <span className="font-medium">{formatRupiah(n(entry.credit))}</span> : <span className="text-muted/40">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${rb < 0 ? "text-danger" : ""}`}>
                        {formatRupiah(rb)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-border/60 px-6 py-3 text-xs text-muted">
          {entries.length} transaksi · Klik di luar untuk menutup
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { data: biz, isLoading: bizLoading } = useActiveBusiness();
  const { startsOn, endsOn, setStartsOn, setEndsOn } = useReportRange();
  const [showEmpty, setShowEmpty] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);

  const { data, isLoading, error } = useGeneralLedgerReport(
    biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn)
  );

  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Buku Besar tidak tersedia" description="Tidak dapat memuat laporan buku besar." />;

  const report = data.data;
  const allAccounts: any[] = report.accounts ?? [];
  const activeAccounts = allAccounts.filter(hasActivity);
  const displayed = showEmpty ? allAccounts : activeAccounts;

  const rows = displayed.map((account: any) => ({
    _account: account,
    account: account,
    opening: n(account.openingBalance),
    debit: n(account.periodDebit),
    credit: n(account.periodCredit),
    closing: n(account.closingBalance),
  }));

  return (
    <>
      <ReportWorkspace
        title="Buku Besar"
        startsOn={startsOn} endsOn={endsOn}
        onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn}
        onExportPdf={() => exportGeneralLedgerPdf(report, biz.name, startsOn, endsOn)}
        onExportExcel={() => exportGeneralLedgerExcel(report, biz.name, startsOn, endsOn)}
      >
        <section className="grid gap-4 md:grid-cols-4">
          <GlassStatsCard title="Akun Ada Mutasi" value={String(activeAccounts.length)} detail={`dari ${allAccounts.length} total akun`} />
          <GlassStatsCard title="Total Debit" value={formatRupiah(displayed.reduce((s, r) => s + n(r.periodDebit), 0))} detail="Periode ini" />
          <GlassStatsCard title="Total Kredit" value={formatRupiah(displayed.reduce((s, r) => s + n(r.periodCredit), 0))} detail="Periode ini" />
          <GlassStatsCard title="Periode" value={fmtDate(startsOn)} detail={`s/d ${fmtDate(endsOn)}`} />
        </section>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Menampilkan <strong className="text-foreground">{displayed.length}</strong> akun
            {!showEmpty && activeAccounts.length < allAccounts.length
              ? ` · ${allAccounts.length - activeAccounts.length} akun kosong disembunyikan`
              : ""}
            {" · "}<span className="text-accent">klik akun untuk lihat transaksi</span>
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
            <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="h-4 w-4 accent-accent" />
            Tampilkan akun kosong
          </label>
        </div>

        <GlassTable
          tableId="report-general-ledger"
          columns={[
            {
              key: "account", header: "Akun",
              render: (row: any) => (
                <button
                  type="button"
                  onClick={() => setSelectedAccount(row._account)}
                  className="group flex w-full items-center justify-between gap-2 text-left"
                >
                  <div>
                    <p className="font-mono text-xs text-muted">{row.account.accountCode}</p>
                    <p className="font-medium group-hover:text-accent">{row.account.accountName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted/40 transition group-hover:text-accent group-hover:translate-x-0.5" />
                </button>
              ),
            },
            {
              key: "opening", header: "Saldo Awal",
              render: (row: any) => row.opening !== 0
                ? <span className="tabular-nums">{formatRupiah(row.opening)}</span>
                : <span className="text-muted/40">—</span>,
            },
            {
              key: "debit", header: "Debit",
              render: (row: any) => row.debit > 0
                ? <span className="tabular-nums font-medium">{formatRupiah(row.debit)}</span>
                : <span className="text-muted/40">—</span>,
            },
            {
              key: "credit", header: "Kredit",
              render: (row: any) => row.credit > 0
                ? <span className="tabular-nums font-medium">{formatRupiah(row.credit)}</span>
                : <span className="text-muted/40">—</span>,
            },
            {
              key: "closing", header: "Saldo Akhir",
              render: (row: any) => row.closing === 0
                ? <span className="text-muted/40">—</span>
                : <span className={`tabular-nums font-semibold ${row.closing < 0 ? "text-danger" : ""}`}>{formatRupiah(row.closing)}</span>,
            },
          ]}
          rows={rows}
          empty="Belum ada data mutasi pada periode ini."
        />
      </ReportWorkspace>

      {selectedAccount && (
        <AccountDrilldown account={selectedAccount} onClose={() => setSelectedAccount(null)} />
      )}
    </>
  );
}
