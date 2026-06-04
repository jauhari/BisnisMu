"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { JournalBalanceBar } from "@/components/accounting/accounting-components";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";

interface Line { accountId: string; side: "DEBIT" | "CREDIT"; amount: string }
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/accounting/journals");
  const journals = useListQuery<any[]>("/api/accounting/journals/list", ["list", "accounting-journals-list"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const postable = useMemo(() => flattenAccounts(accounts.data?.data ?? []).filter((a) => a.isPostingAllowed), [accounts.data]);
  const [transactionDate, setTransactionDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; });
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

  const rows = (journals.data?.data ?? []).flatMap((entry: any) =>
    (entry.lines ?? []).map((line: any) => ({
      tanggal:  new Date(entry.transactionDate).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
      nomor:    entry.journalNumber,
      account:  line.account ? `${line.account.code} | ${line.account.name}` : line.accountId,
      debit:    line.side === "DEBIT"  ? Number(line.amount).toLocaleString("id-ID") : "-",
      credit:   line.side === "CREDIT" ? Number(line.amount).toLocaleString("id-ID") : "-",
      memo:     line.memo ?? entry.description ?? "",
    }))
  );

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Accounting" title="Journal Entries" description="Post and trace balanced journals through JournalPostingService." /><GlassPanel><div className="grid gap-4"><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Transaction date</span><GlassInput value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} placeholder="2026-05-31" /></label><label className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Description</span><GlassInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Journal description" /></label></div><div className="grid gap-3">{lines.map((line, i) => <div key={i} className="grid items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"><label className="grid gap-1"><span className="text-xs text-muted">Account</span><GlassDataSelect value={line.accountId} onChange={(v) => update(i, { accountId: v })} placeholder="Pilih akun" options={postable.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Side</span><GlassDataSelect value={line.side} onChange={(v) => update(i, { side: v as Line["side"] })} options={[{ value: "DEBIT", label: "DEBIT" }, { value: "CREDIT", label: "CREDIT" }]} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Amount</span><GlassInput value={line.amount} onChange={(e) => update(i, { amount: e.target.value })} className="h-10" placeholder="0" /></label><button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2} className="h-10 rounded-md border border-border px-3 text-sm disabled:opacity-40">Hapus</button></div>)}</div><div className="flex gap-2"><button type="button" onClick={addLine} className="h-10 rounded-md border border-border px-4 text-sm">+ Tambah baris</button><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Post journal</button></div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}<JournalBalanceBar debit={BigInt(debit)} credit={BigInt(credit)} /></div></GlassPanel><GlassTable tableId="accounting-journals" columns={[{ key: "tanggal", header: "Tanggal" }, { key: "nomor", header: "No. Jurnal" }, { key: "account", header: "Akun" }, { key: "debit", header: "Debit", render: (row: any) => row.debit }, { key: "credit", header: "Kredit", render: (row: any) => row.credit }, { key: "memo", header: "Memo" }]} rows={rows} empty="No journal lines posted" /></div>;
}
