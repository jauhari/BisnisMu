"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const recons = useListQuery<any[]>("/api/cash/reconciliation", ["list", "cash-reconciliation"]);
  const sessions = useListQuery<any[]>("/api/cash/sessions", ["list", "cash-sessions"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const expenseAccounts = flat.filter((a: any) => (a.groupCode === 6 || a.groupCode === 7) && a.isPostingAllowed);

  const allSessions: any[] = (sessions.data as any)?.data ?? [];
  const closedSessions = allSessions.filter((s: any) => s.status === "CLOSED");

  const [sessionId, setSessionId] = useState("");
  const [countedAmount, setCountedAmount] = useState("");
  const [differenceAccountId, setDifferenceAccountId] = useState("");
  const [reconciledAt, setReconciledAt] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [busy, setBusy] = useState(false);

  if (recons.isLoading || sessions.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (recons.error) return <GlassErrorState title="Rekonsiliasi tidak tersedia" description="Tidak dapat memuat data rekonsiliasi." />;

  const rows = ((recons.data as any)?.data ?? []).map((r: any) => ({
    session: r.sessionId?.slice(-8) ?? "—",
    date: String(r.reconciledAt).slice(0, 10),
    expected: formatRupiah(r.expectedAmount ?? 0),
    counted: formatRupiah(r.countedAmount ?? 0),
    difference: formatRupiah(r.differenceAmount ?? 0),
    status: Number(r.differenceAmount ?? 0) === 0 ? "Seimbang" : "Selisih",
  }));

  async function submit() {
    if (!sessionId) { toast.error("Pilih sesi kas."); return; }
    if (!differenceAccountId) { toast.error("Pilih akun selisih."); return; }
    setBusy(true);
    try {
      const result = await postJson("/api/cash/reconciliation", {
        sessionId,
        reconciledAt: new Date(reconciledAt).toISOString(),
        countedAmount: Number(countedAmount) || 0,
        differenceAccountId,
      });
      const diff = result.data?.reconciliation?.differenceAmount;
      toast.success(diff === "0" || diff === 0 ? "Rekonsiliasi selesai — saldo seimbang." : `Rekonsiliasi selesai. Selisih: ${formatRupiah(diff ?? 0)} diposting ke akun beban.`);
      setSessionId(""); setCountedAmount("");
      void qc.invalidateQueries({ queryKey: ["list", "cash-reconciliation"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="Cash Management" title="Rekonsiliasi Kas" description="Cocokkan saldo kas aktual dengan ekspektasi setelah tutup sesi. Selisih otomatis diposting ke jurnal." />
      <SplitWorkspace
        main={<GlassTable tableId="cash-reconciliation" columns={[{ key: "session", header: "Sesi" }, { key: "date", header: "Tanggal" }, { key: "expected", header: "Ekspektasi" }, { key: "counted", header: "Terhitung" }, { key: "difference", header: "Selisih" }, { key: "status", header: "Status" }]} rows={rows} empty="Belum ada rekonsiliasi." />}
        side={
          <GlassPanel className="grid gap-4">
            <h2 className="text-sm font-semibold">Rekonsiliasi baru</h2>
            <label className="grid gap-1 text-xs">
              Sesi kas (sudah tutup)
              <GlassDataSelect
                value={sessionId}
                onChange={setSessionId}
                placeholder={closedSessions.length ? "Pilih sesi" : "Belum ada sesi yang tutup"}
                options={closedSessions.map((s: any) => ({ value: s.id, label: `${s.id.slice(-8)} · tutup ${String(s.closedAt).slice(0, 10)}` }))}
                className="h-9"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Tanggal rekonsiliasi
              <GlassDatePicker value={reconciledAt} onChange={setReconciledAt} className="h-9" />
            </label>
            <label className="grid gap-1 text-xs">
              Jumlah kas terhitung (aktual)
              <GlassInput type="number" min={0} value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} placeholder="0" className="h-9" />
            </label>
            <label className="grid gap-1 text-xs">
              Akun posting selisih
              <GlassDataSelect
                value={differenceAccountId}
                onChange={setDifferenceAccountId}
                placeholder="Pilih akun beban"
                options={expenseAccounts.map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }))}
                className="h-9"
              />
            </label>
            <button type="button" disabled={busy || !sessionId || !differenceAccountId} onClick={() => void submit()} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">
              {busy ? "Memproses…" : "Rekonsiliasi"}
            </button>
            <DetailPanel title="Cara kerja">Jika kas terhitung ≠ ekspektasi, selisih diposting sebagai jurnal debet/kredit ke akun yang dipilih.</DetailPanel>
          </GlassPanel>
        }
      />
    </div>
  );
}
