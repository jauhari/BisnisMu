"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { JournalBalanceBar } from "@/components/accounting/accounting-components";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

interface Line { accountId: string; side: "DEBIT" | "CREDIT"; amount: string }
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/accounting/journals");
  const journals = useListQuery<any[]>("/api/accounting/journals/list", ["list", "accounting-journals-list"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const postable = useMemo(() => flattenAccounts(accounts.data?.data ?? []).filter((a) => a.isPostingAllowed), [accounts.data]);
  const [transactionDate, setTransactionDate] = useState("2026-05-31");
  const [description, setDescription] = useState("Manual adjustment");
  const [lines, setLines] = useState<Line[]>([{ accountId: "", side: "DEBIT", amount: "" }, { accountId: "", side: "CREDIT", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (accounts.isLoading || journals.isLoading) return <GlassSkeleton className="h-72" />;
  if (accounts.error || journals.error) return <GlassErrorState title="Journals unavailable" description="Unable to load journal data." />;

  const debit = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const credit = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { accountId: "", side: "DEBIT", amount: "" }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  async function submit() {
    setError(null); setOkMsg(null);
    const valid = lines.filter((l) => l.accountId && Number(l.amount) > 0);
    if (valid.length < 2) { setError("Minimal 2 baris dengan akun dan jumlah > 0."); return; }
    if (debit !== credit) { setError("Total debit harus sama dengan total kredit."); return; }
    try {
      await mutation.mutateAsync({ transactionDate, source: "MANUAL_JOURNAL", description, lines: valid.map((l) => ({ accountId: l.accountId, side: l.side, amount: l.amount })) });
      setOkMsg("Jurnal terposting."); setLines([{ accountId: "", side: "DEBIT", amount: "" }, { accountId: "", side: "CREDIT", amount: "" }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memposting jurnal."); }
  }

  const rows = (journals.data?.data ?? []).map((r: any) => ({ account: r.account ?? r.accountId, debit: r.debit ?? "-", credit: r.credit ?? "-", memo: r.memo ?? r.description ?? "" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Accounting" title="Journal Entries" description="Post and trace balanced journals through JournalPostingService." /><GlassPanel><div className="grid gap-4"><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Transaction date</span><input value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="h-11 rounded-md border border-border bg-white/60 px-3 text-sm dark:bg-white/8" placeholder="2026-05-31" /></label><label className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 rounded-md border border-border bg-white/60 px-3 text-sm dark:bg-white/8" placeholder="Journal description" /></label></div><div className="grid gap-3">{lines.map((line, i) => <div key={i} className="grid items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"><label className="grid gap-1"><span className="text-xs text-muted">Account</span><select value={line.accountId} onChange={(e) => update(i, { accountId: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">Pilih akun</option>{postable.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Side</span><select value={line.side} onChange={(e) => update(i, { side: e.target.value as Line["side"] })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="DEBIT">DEBIT</option><option value="CREDIT">CREDIT</option></select></label><label className="grid gap-1"><span className="text-xs text-muted">Amount</span><input value={line.amount} onChange={(e) => update(i, { amount: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" placeholder="0" /></label><button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2} className="h-10 rounded-md border border-border px-3 text-sm disabled:opacity-40">Hapus</button></div>)}</div><div className="flex gap-2"><button type="button" onClick={addLine} className="h-10 rounded-md border border-border px-4 text-sm">+ Tambah baris</button><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Post journal</button></div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}<JournalBalanceBar debit={BigInt(debit)} credit={BigInt(credit)} /></div></GlassPanel><GlassTable columns={[{ key: "account", header: "Account" }, { key: "debit", header: "Debit" }, { key: "credit", header: "Credit" }, { key: "memo", header: "Memo" }]} rows={rows} empty="No journal lines posted" /></div>;
}
