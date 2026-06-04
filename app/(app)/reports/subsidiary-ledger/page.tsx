"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton, GlassErrorState } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassDataSelect, GlassDatePicker } from "@/components/forms/glass-form";
import { ReportFilterBar } from "@/components/charts/report-layout";
import { apiRequest } from "@/presentation/api/client";
import { useActiveBusiness, useReportRange } from "@/presentation/query/report-hooks";
import { formatRupiah } from "@/presentation/format/number";

type SubType = "kas" | "piutang" | "utang";

const TYPE_OPTIONS = [
  { value: "kas",     label: "Buku Pembantu Kas" },
  { value: "piutang", label: "Buku Pembantu Piutang" },
  { value: "utang",   label: "Buku Pembantu Utang" },
];

function n(v: any) { return Number(v ?? 0); }
function rupiah(v: any) { return formatRupiah(n(v)); }
function tgl(v: any) { return v ? new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"; }
function status(s: string) {
  const map: Record<string, string> = { PAID: "Lunas", PARTIAL: "Sebagian", DRAFT: "Draft", POSTED: "Terbit", VOID: "Batal" };
  return map[s] ?? s;
}

export default function Page() {
  const { data: biz } = useActiveBusiness();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const [subType, setSubType] = useState<SubType>("kas");
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["subsidiary-ledger", biz?.id, subType, startsOn, endsOn],
    queryFn: () => apiRequest("/api/reports/subsidiary-ledger", {
      method: "POST",
      body: JSON.stringify({ type: subType, startsOn, endsOn }),
    }),
    enabled: !!biz,
    placeholderData: (prev) => prev,
  });

  const report = (data as any)?.data;

  return (
    <div className="grid gap-6">
      <ReportFilterBar
        title="Buku Pembantu"
        startsOn={startsOn} endsOn={endsOn}
        onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn}
        activePreset={activePreset} onPresetChange={setActivePreset}
      />

      {/* Pilih jenis buku pembantu */}
      <GlassPanel className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Jenis:</span>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setSubType(opt.value as SubType); setExpandedAccount(null); setExpandedContact(null); }}
            className={`h-8 rounded-lg px-4 text-sm transition ${subType === opt.value ? "bg-accent text-white font-medium" : "border border-border text-muted hover:border-accent/60"}`}
          >
            {opt.label}
          </button>
        ))}
      </GlassPanel>

      {isLoading && <GlassSkeleton className="h-64" />}
      {error && <GlassErrorState title="Gagal memuat" description="Tidak dapat memuat buku pembantu." />}

      {/* ── KAS ─────────────────────────────────────────────────────────────── */}
      {!isLoading && report?.type === "kas" && (
        <div className="grid gap-4">
          {(report.accounts ?? []).map((acc: any) => (
            <GlassPanel key={acc.accountId} className="grid gap-3">
              {/* Header akun */}
              <div
                className="flex cursor-pointer items-center justify-between"
                onClick={() => setExpandedAccount(expandedAccount === acc.accountId ? null : acc.accountId)}
              >
                <div>
                  <p className="text-xs text-muted">{acc.kodeAkun}</p>
                  <h3 className="font-semibold">{acc.namaAkun}</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Saldo Akhir</p>
                  <p className={`font-semibold tabular-nums ${n(acc.saldoAkhir) >= 0 ? "text-success" : "text-danger"}`}>
                    {rupiah(acc.saldoAkhir)}
                  </p>
                </div>
              </div>

              {expandedAccount === acc.accountId && (
                <>
                  {/* Saldo awal */}
                  <div className="flex justify-between border-b border-border pb-2 text-xs text-muted">
                    <span>Saldo Awal Periode</span>
                    <span className="tabular-nums font-medium">{rupiah(acc.saldoAwal)}</span>
                  </div>

                  {acc.mutasi?.length === 0 ? (
                    <p className="text-center text-sm text-muted py-4">Tidak ada mutasi dalam periode ini.</p>
                  ) : (
                    <GlassTable
                      tableId={`bp-kas-${acc.accountId}`}
                      columns={[
                        { key: "tanggal",    header: "Tanggal",    render: (r: any) => tgl(r.tanggal) },
                        { key: "nomor",      header: "No. Jurnal" },
                        { key: "keterangan", header: "Keterangan" },
                        { key: "debit",      header: "Debit",      render: (r: any) => n(r.debit) > 0 ? rupiah(r.debit) : "-" },
                        { key: "kredit",     header: "Kredit",     render: (r: any) => n(r.kredit) > 0 ? rupiah(r.kredit) : "-" },
                        { key: "saldo",      header: "Saldo",      render: (r: any) => <span className={`tabular-nums font-medium ${n(r.saldo) >= 0 ? "" : "text-danger"}`}>{rupiah(r.saldo)}</span> },
                      ]}
                      rows={acc.mutasi ?? []}
                      empty="Tidak ada mutasi."
                    />
                  )}
                </>
              )}
            </GlassPanel>
          ))}

          {(report.accounts ?? []).length === 0 && (
            <GlassPanel><p className="text-center text-sm text-muted py-6">Tidak ada akun kas/bank ditemukan.</p></GlassPanel>
          )}
        </div>
      )}

      {/* ── PIUTANG ──────────────────────────────────────────────────────────── */}
      {!isLoading && report?.type === "piutang" && (
        <div className="grid gap-4">
          {/* Summary total */}
          <GlassPanel className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted">Total Piutang</p>
              <p className="font-semibold text-foreground tabular-nums">
                {rupiah((report.contacts ?? []).reduce((s: number, c: any) => s + n(c.totalTagihan), 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Sudah Lunas</p>
              <p className="font-semibold text-success tabular-nums">
                {rupiah((report.contacts ?? []).reduce((s: number, c: any) => s + n(c.totalLunas), 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Sisa Piutang</p>
              <p className="font-semibold text-warning tabular-nums">
                {rupiah((report.contacts ?? []).reduce((s: number, c: any) => s + n(c.sisaPiutang), 0))}
              </p>
            </div>
          </GlassPanel>

          {(report.contacts ?? []).map((c: any) => (
            <GlassPanel key={c.contactId} className="grid gap-3">
              <div className="flex cursor-pointer items-center justify-between"
                onClick={() => setExpandedContact(expandedContact === c.contactId ? null : c.contactId)}>
                <div>
                  <p className="text-xs text-muted">{c.kategori}</p>
                  <h3 className="font-semibold">{c.nama}</h3>
                </div>
                <div className="flex gap-6 text-right">
                  <div><p className="text-xs text-muted">Tagihan</p><p className="tabular-nums">{rupiah(c.totalTagihan)}</p></div>
                  <div><p className="text-xs text-muted">Sisa</p><p className={`font-semibold tabular-nums ${n(c.sisaPiutang) > 0 ? "text-warning" : "text-success"}`}>{rupiah(c.sisaPiutang)}</p></div>
                </div>
              </div>
              {expandedContact === c.contactId && (
                <GlassTable
                  tableId={`bp-piutang-${c.contactId}`}
                  columns={[
                    { key: "nomor",     header: "No. Invoice" },
                    { key: "tanggal",   header: "Tanggal",     render: (r: any) => tgl(r.tanggal) },
                    { key: "jatuhTempo",header: "Jatuh Tempo", render: (r: any) => tgl(r.jatuhTempo) },
                    { key: "jumlah",    header: "Jumlah",      render: (r: any) => rupiah(r.jumlah) },
                    { key: "status",    header: "Status",      render: (r: any) => status(r.status) },
                  ]}
                  rows={c.invoices ?? []}
                  empty="Tidak ada invoice."
                />
              )}
            </GlassPanel>
          ))}

          {(report.contacts ?? []).length === 0 && (
            <GlassPanel><p className="text-center text-sm text-muted py-6">Tidak ada data piutang dalam periode ini.</p></GlassPanel>
          )}
        </div>
      )}

      {/* ── UTANG ────────────────────────────────────────────────────────────── */}
      {!isLoading && report?.type === "utang" && (
        <div className="grid gap-4">
          <GlassPanel className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted">Total Utang</p>
              <p className="font-semibold text-foreground tabular-nums">
                {rupiah((report.contacts ?? []).reduce((s: number, c: any) => s + n(c.totalTagihan), 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Sudah Dibayar</p>
              <p className="font-semibold text-success tabular-nums">
                {rupiah((report.contacts ?? []).reduce((s: number, c: any) => s + n(c.totalLunas), 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Sisa Utang</p>
              <p className="font-semibold text-danger tabular-nums">
                {rupiah((report.contacts ?? []).reduce((s: number, c: any) => s + n(c.sisaUtang), 0))}
              </p>
            </div>
          </GlassPanel>

          {(report.contacts ?? []).map((c: any) => (
            <GlassPanel key={c.contactId} className="grid gap-3">
              <div className="flex cursor-pointer items-center justify-between"
                onClick={() => setExpandedContact(expandedContact === c.contactId ? null : c.contactId)}>
                <div>
                  <p className="text-xs text-muted">{c.kategori}</p>
                  <h3 className="font-semibold">{c.nama}</h3>
                </div>
                <div className="flex gap-6 text-right">
                  <div><p className="text-xs text-muted">Tagihan</p><p className="tabular-nums">{rupiah(c.totalTagihan)}</p></div>
                  <div><p className="text-xs text-muted">Sisa</p><p className={`font-semibold tabular-nums ${n(c.sisaUtang) > 0 ? "text-danger" : "text-success"}`}>{rupiah(c.sisaUtang)}</p></div>
                </div>
              </div>
              {expandedContact === c.contactId && (
                <GlassTable
                  tableId={`bp-utang-${c.contactId}`}
                  columns={[
                    { key: "nomor",      header: "No. Tagihan" },
                    { key: "tanggal",    header: "Tanggal",     render: (r: any) => tgl(r.tanggal) },
                    { key: "jatuhTempo", header: "Jatuh Tempo", render: (r: any) => tgl(r.jatuhTempo) },
                    { key: "jumlah",     header: "Jumlah",      render: (r: any) => rupiah(r.jumlah) },
                    { key: "status",     header: "Status",      render: (r: any) => status(r.status) },
                  ]}
                  rows={c.bills ?? []}
                  empty="Tidak ada tagihan."
                />
              )}
            </GlassPanel>
          ))}

          {(report.contacts ?? []).length === 0 && (
            <GlassPanel><p className="text-center text-sm text-muted py-6">Tidak ada data utang dalam periode ini.</p></GlassPanel>
          )}
        </div>
      )}
    </div>
  );
}
