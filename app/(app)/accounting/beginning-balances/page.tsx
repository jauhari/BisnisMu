"use client";

import { useMemo, useState } from "react";
import { JournalBalanceBar } from "@/components/accounting/accounting-components";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";
import { formatRupiah } from "@/presentation/format/number";

interface Line { accountId: string; side: "DEBIT" | "CREDIT"; amount: string }
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/accounting/beginning-balances");
  const balances = useListQuery<any[]>("/api/accounting/beginning-balances", ["list", "accounting-beginning-balances"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const periods = useListQuery<any[]>("/api/accounting/fiscal-periods", ["list", "accounting-periods"]);

  const postable = useMemo(() => flattenAccounts(accounts.data?.data ?? []).filter((a) => a.isPostingAllowed), [accounts.data]);
  const periodList = periods.data?.data ?? [];
  const [fiscalPeriodId, setFiscalPeriodId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ accountId: "", side: "DEBIT", amount: "" }, { accountId: "", side: "CREDIT", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (accounts.isLoading || balances.isLoading || periods.isLoading) return <GlassSkeleton className="h-72" />;
  if (accounts.error || balances.error) return <GlassErrorState title="Saldo awal belum bisa dimuat" description="Coba muat ulang halaman ini beberapa saat lagi." />;

  const debit = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const credit = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { accountId: "", side: "DEBIT", amount: "" }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  async function submit() {
    setError(null); setOkMsg(null);
    if (!fiscalPeriodId) { setError("Pilih periode dulu."); return; }
    const valid = lines.filter((l) => l.accountId && Number(l.amount) >= 0 && l.amount !== "");
    if (valid.length < 1) { setError("Minimal 1 baris dengan akun dan jumlah."); return; }
    try {
      await mutation.mutateAsync({ fiscalPeriodId, lines: valid.map((l) => ({ accountId: l.accountId, side: l.side, amount: l.amount })) });
      setOkMsg("Saldo awal tersimpan."); setLines([{ accountId: "", side: "DEBIT", amount: "" }, { accountId: "", side: "CREDIT", amount: "" }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan."); }
  }

  const rows = (balances.data?.data ?? []).map((r: any) => ({ account: r.account, side: r.side === "DEBIT" ? "Debit" : r.side === "CREDIT" ? "Kredit" : r.side, amount: formatRupiah(r.amount), status: r.status }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Akuntansi" title="Saldo Awal" description="Isi saldo awal tiap akun. Total debit harus sama dengan kredit." /><GlassPanel><div className="grid gap-4"><label className="grid gap-2 md:max-w-sm"><span className="text-xs font-medium uppercase tracking-wide text-muted">Periode</span><GlassDataSelect value={fiscalPeriodId} onChange={setFiscalPeriodId} placeholder={periodList.length ? "Pilih periode" : "Belum ada periode"} options={periodList.map((p: any) => ({ value: p.id, label: p.fiscalYear }))} /></label><div className="grid gap-3">{lines.map((line, i) => <div key={i} className="grid items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"><label className="grid gap-1"><span className="text-xs text-muted">Akun</span><GlassDataSelect value={line.accountId} onChange={(v) => update(i, { accountId: v })} placeholder="Pilih akun" options={postable.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Posisi</span><GlassDataSelect value={line.side} onChange={(v) => update(i, { side: v as Line["side"] })} options={[{ value: "DEBIT", label: "Debit" }, { value: "CREDIT", label: "Kredit" }]} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Nominal</span><GlassInput value={line.amount} onChange={(e) => update(i, { amount: e.target.value })} className="h-10" placeholder="0" /></label><button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 1} className="h-10 rounded-md border border-border px-3 text-sm disabled:opacity-40">Hapus</button></div>)}</div><div className="flex gap-2"><button type="button" onClick={addLine} className="h-10 rounded-md border border-border px-4 text-sm">+ Tambah baris</button><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan saldo awal</button></div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}<JournalBalanceBar debit={BigInt(debit)} credit={BigInt(credit)} /></div></GlassPanel><GlassTable columns={[{ key: "account", header: "Akun" }, { key: "side", header: "Posisi" }, { key: "amount", header: "Nominal" }, { key: "status", header: "Status" }]} rows={rows} empty="Belum ada saldo awal." /></div>;
}
