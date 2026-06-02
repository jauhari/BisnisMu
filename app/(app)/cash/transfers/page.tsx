"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";

const today = new Date().toISOString().slice(0, 10);
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/cash/transfers");
  const list = useListQuery<any[]>("/api/cash/transfers", ["list", "cash-transfers"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [movementDate, setMovementDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const cashAccounts = flat.filter((a: any) => a.subtype === "cash" && a.isPostingAllowed);

  if (list.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Cash transfers unavailable" description="Unable to load cash transfers." />;

  async function submit() {
    setError(null); setOkMsg(null);
    if (!sourceId || !destId) { setError("Pilih akun kas sumber dan tujuan."); return; }
    if (sourceId === destId) { setError("Akun sumber dan tujuan harus berbeda."); return; }
    if (!amount || Number(amount) <= 0) { setError("Isi jumlah transfer > 0."); return; }
    if (description.trim().length < 2) { setError("Isi deskripsi transfer."); return; }
    try {
      await mutation.mutateAsync({ sourceCashAccountId: sourceId, destinationCashAccountId: destId, movementDate, amount, description: description.trim() });
      setOkMsg("Transfer kas tersimpan."); setSourceId(""); setDestId(""); setAmount(""); setDescription("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan transfer."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((m: any) => ({ number: m.id?.slice(-6) ?? "", account: m.cashAccountId ?? "", date: String(m.movementDate).slice(0, 10), amount: String(m.amount ?? ""), status: m.postedJournalId ? "Posted" : "Draft" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Cash Management" title="Cash Transfers" description="Transfer cash between accounts. Posts a journal entry (DR destination / CR source)." /><SplitWorkspace main={<GlassTable columns={[{ key: "number", header: "Number" }, { key: "account", header: "Account" }, { key: "date", header: "Date" }, { key: "amount", header: "Amount" }, { key: "status", header: "Status" }]} rows={rows} empty="No cash transfers loaded" />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Source cash account</span><select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{cashAccounts.length ? "Pilih akun sumber" : "Belum ada akun kas"}</option>{cashAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Destination cash account</span><select value={destId} onChange={(e) => setDestId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{cashAccounts.length ? "Pilih akun tujuan" : "Belum ada akun kas"}</option>{cashAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Movement date</span><input value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" /></label><label className="grid gap-1"><span className="text-xs text-muted">Amount</span><input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" placeholder="0" /></label><label className="grid gap-1"><span className="text-xs text-muted">Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" placeholder="Transfer kas ke bank" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Create transfer</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Controls">Transfers remain traceable through journal and audit links.</DetailPanel></>} /></div>;
}
