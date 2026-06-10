"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ManagedForm, RhfTextField } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { GlassInput } from "@/components/forms/glass-form";

const openSchema = z.object({ fiscalYear: z.string().regex(/^\d{4}$/, "Tahun 4 digit") });
type OpenForm = z.infer<typeof openSchema>;

async function postJson(path: string, body?: unknown) {
  const init: RequestInit = { method: "POST", credentials: "include", headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const openMutation = usePostMutation("/api/accounting/fiscal-periods");
  const { data, isLoading, error } = useListQuery<any[]>("/api/accounting/fiscal-periods", ["list", "accounting-periods"]);

  const [reopenId, setReopenId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ msg: string; onOk: () => void } | null>(null);

  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Fiscal periods tidak tersedia" description="Tidak dapat memuat periode fiskal." />;

  const periods: any[] = data.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["list", "accounting-periods"] });

  async function handleClose(id: string, year: number) {
    setConfirmDialog({
      msg: `Tutup periode fiskal ${year}? Transaksi baru tidak bisa diposting ke periode ini.`,
      onOk: async () => {
        setBusy(true);
        try {
          await postJson(`/api/accounting/fiscal-periods/${id}/close`);
          toast.success(`Periode ${year} berhasil ditutup.`);
          refresh();
        } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
        finally { setBusy(false); }
      },
    });
  }

  async function handleCloseWithEarnings(id: string, year: number) {
    setConfirmDialog({
      msg: `Tutup periode ${year} dan transfer laba/rugi ke Saldo Laba? Jurnal penutup akan diposting otomatis.`,
      onOk: async () => {
        setBusy(true);
        try {
          await postJson(`/api/accounting/fiscal-periods/${id}/transfer-earnings`);
          toast.success(`Periode ${year} ditutup dan laba ditransfer ke Saldo Laba.`);
          refresh();
        } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
        finally { setBusy(false); }
      },
    });
  }

  async function handleReopen(id: string) {
    if (!reopenReason.trim() || reopenReason.trim().length < 5) { toast.error("Alasan minimal 5 karakter."); return; }
    setBusy(true);
    try {
      await postJson(`/api/accounting/fiscal-periods/${id}/reopen`, { reason: reopenReason.trim() });
      toast.success("Periode berhasil dibuka kembali.");
      setReopenId(null); setReopenReason("");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  const rows = periods.map((p: any) => ({
    id: p.id,
    year: p.fiscalYear,
    start: p.startsOn?.slice?.(0, 10) ?? p.startsOn,
    end: p.endsOn?.slice?.(0, 10) ?? p.endsOn,
    status: p.status,
    closedBy: p.closedByUserId ?? "—",
    actions: p.status,
  }));

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="Accounting" title="Fiscal Periods" description="Buka, tutup, dan buka kembali periode fiskal melalui BusinessService." />
      <SplitWorkspace
        main={
          <>
            <ManagedForm<OpenForm>
              schema={openSchema}
              defaultValues={{ fiscalYear: String(new Date().getFullYear()) }}
              onSubmit={async (values) => { await openMutation.mutateAsync({ fiscalYear: Number(values.fiscalYear) }); refresh(); }}
            >
              {() => (
                <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
                  <RhfTextField<OpenForm> name="fiscalYear" label="Tahun fiskal" placeholder="2026" />
                  <button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Buka periode</button>
                </div>
              )}
            </ManagedForm>
            <GlassTable
              columns={[
                { key: "year", header: "Tahun" },
                { key: "start", header: "Mulai" },
                { key: "end", header: "Akhir" },
                { key: "status", header: "Status" },
                { key: "closedBy", header: "Ditutup oleh" },
                {
                  key: "actions",
                  header: "Aksi",
                  render: (row: any) => {
                    const p = periods.find((x) => x.id === row.id);
                    if (!p) return null;
                    if (p.status === "OPEN") return (
                      <div className="flex gap-1">
                        <button type="button" disabled={busy} onClick={() => handleCloseWithEarnings(p.id, p.fiscalYear)} className="h-7 rounded-md bg-foreground px-2 text-xs text-background disabled:opacity-40">Tutup + Transfer Laba</button>
                        <button type="button" disabled={busy} onClick={() => handleClose(p.id, p.fiscalYear)} className="h-7 rounded-md border border-border px-2 text-xs disabled:opacity-40">Tutup saja</button>
                      </div>
                    );
                    if (p.status === "CLOSED") return (
                      <button type="button" disabled={busy} onClick={() => setReopenId(reopenId === p.id ? null : p.id)} className="h-7 rounded-md border border-border px-3 text-xs disabled:opacity-40">Buka ulang</button>
                    );
                    return null;
                  },
                },
              ]}
              rows={rows}
              empty="Belum ada periode fiskal."
            />
            {confirmDialog ? (
              <GlassPanel className="grid gap-3">
                <p className="text-sm">{confirmDialog.msg}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { void confirmDialog.onOk(); setConfirmDialog(null); }} className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background">Ya, lanjutkan</button>
                  <button type="button" onClick={() => setConfirmDialog(null)} className="h-9 rounded-md border border-border px-4 text-sm">Batal</button>
                </div>
              </GlassPanel>
            ) : null}
            {reopenId ? (
              <GlassPanel className="grid gap-3">
                <p className="text-sm font-medium">Buka ulang periode — wajib isi alasan audit</p>
                <GlassInput value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Alasan minimal 5 karakter…" className="h-9" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => handleReopen(reopenId)} className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">Konfirmasi</button>
                  <button type="button" onClick={() => { setReopenId(null); setReopenReason(""); }} className="h-9 rounded-md border border-border px-4 text-sm">Batal</button>
                </div>
              </GlassPanel>
            ) : null}
          </>
        }
        side={
          <>
            <DetailPanel title="Buka periode">Tanggal periode dihitung dari bulan awal tahun fiskal yang dikonfigurasi di pengaturan usaha.</DetailPanel>
            <DetailPanel title="Tutup + Transfer Laba">Menutup periode dan memposting jurnal penutup otomatis — mentransfer saldo akun pendapatan/beban ke Saldo Laba (retained earnings).</DetailPanel>
            <DetailPanel title="Tutup saja">Menutup periode tanpa memposting jurnal penutup. Gunakan bila transfer laba sudah dilakukan manual.</DetailPanel>
            <DetailPanel title="Buka ulang periode">Memerlukan alasan audit dan tercatat di audit log.</DetailPanel>
          </>
        }
      />
    </div>
  );
}
