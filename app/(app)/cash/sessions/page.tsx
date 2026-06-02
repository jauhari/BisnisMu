"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";

const now = () => new Date().toISOString().slice(0, 16);
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/cash/sessions");
  const list = useListQuery<any[]>("/api/cash/sessions", ["list", "cash-sessions"]);
  const drawers = useListQuery<any[]>("/api/cash/drawers", ["list", "cash-drawers"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const [mode, setMode] = useState<"open" | "close">("open");
  const [drawerId, setDrawerId] = useState("");
  const [openedAt, setOpenedAt] = useState(now());
  const [openingAmount, setOpeningAmount] = useState("");
  const [equityAccountId, setEquityAccountId] = useState("");
  const [shiftCode, setShiftCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [closedAt, setClosedAt] = useState(now());
  const [countedAmount, setCountedAmount] = useState("");
  const [differenceAccountId, setDifferenceAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const equityAccounts = flat.filter((a: any) => a.groupCode === 3 && a.isPostingAllowed);
  const expenseAccounts = flat.filter((a: any) => (a.groupCode === 6 || a.groupCode === 7) && a.isPostingAllowed);
  const drawerList = (drawers.data as any)?.data ?? [];
  const sessions = ((list.data as any)?.data ?? []) as any[];
  const openSessions = sessions.filter((s: any) => s.status === "OPEN");

  if (list.isLoading || drawers.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Cash sessions unavailable" description="Unable to load cash sessions." />;

  async function submitOpen() {
    setError(null); setOkMsg(null);
    if (!drawerId) { setError("Pilih cash drawer."); return; }
    if (!equityAccountId) { setError("Pilih akun equity/modal."); return; }
    try {
      await mutation.mutateAsync({ drawerId, openedAt, openingAmount: openingAmount || "0", equityAccountId, shiftCode: shiftCode || undefined });
      setOkMsg("Sesi kas dibuka."); setDrawerId(""); setOpeningAmount(""); setShiftCode("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal membuka sesi."); }
  }

  async function submitClose() {
    setError(null); setOkMsg(null);
    if (!sessionId) { setError("Pilih sesi yang mau ditutup."); return; }
    if (!differenceAccountId) { setError("Pilih akun selisih."); return; }
    try {
      await mutation.mutateAsync({ sessionId, closedAt, countedAmount: countedAmount || "0", differenceAccountId });
      setOkMsg("Sesi kas ditutup."); setSessionId(""); setCountedAmount("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menutup sesi."); }
  }

  const rows = sessions.map((s: any) => ({ drawer: s.drawerId?.slice(-6) ?? "", status: s.status, opened: String(s.openedAt).slice(0, 16), closed: s.closedAt ? String(s.closedAt).slice(0, 16) : "-", opening: String(s.openingAmount ?? "") }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Cash Management" title="Cash Sessions" description="Open and close cash sessions for cash drawers. Posts opening/closing journals." /><SplitWorkspace main={<GlassTable columns={[{ key: "drawer", header: "Drawer" }, { key: "status", header: "Status" }, { key: "opened", header: "Opened" }, { key: "closed", header: "Closed" }, { key: "opening", header: "Opening" }]} rows={rows} empty="No cash sessions loaded" />} side={<><GlassPanel><div className="mb-4 flex gap-2"><button type="button" onClick={() => setMode("open")} className={`h-9 rounded-md px-3 text-sm font-medium ${mode === "open" ? "bg-foreground text-background" : "border border-border"}`}>Open session</button><button type="button" onClick={() => setMode("close")} className={`h-9 rounded-md px-3 text-sm font-medium ${mode === "close" ? "bg-foreground text-background" : "border border-border"}`}>Close session</button></div>{mode === "open" ? <div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Cash drawer</span><select value={drawerId} onChange={(e) => setDrawerId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{drawerList.length ? "Pilih drawer" : "Belum ada drawer"}</option>{drawerList.map((d: any) => <option key={d.id} value={d.id}>{d.name ?? d.id.slice(-6)}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Opened at</span><input value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" /></label><label className="grid gap-1"><span className="text-xs text-muted">Opening amount</span><input value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" placeholder="0" /></label><label className="grid gap-1"><span className="text-xs text-muted">Equity account</span><select value={equityAccountId} onChange={(e) => setEquityAccountId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">Pilih akun equity</option>{equityAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Shift code (optional)</span><input value={shiftCode} onChange={(e) => setShiftCode(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" placeholder="PAGI" /></label><button type="button" onClick={() => void submitOpen()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Open session</button></div> : <div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Open session</span><select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{openSessions.length ? "Pilih sesi" : "Tidak ada sesi terbuka"}</option>{openSessions.map((s: any) => <option key={s.id} value={s.id}>{s.id.slice(-6)} · {String(s.openedAt).slice(0, 16)}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Closed at</span><input value={closedAt} onChange={(e) => setClosedAt(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" /></label><label className="grid gap-1"><span className="text-xs text-muted">Counted amount</span><input value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" placeholder="0" /></label><label className="grid gap-1"><span className="text-xs text-muted">Difference account</span><select value={differenceAccountId} onChange={(e) => setDifferenceAccountId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">Pilih akun selisih</option>{expenseAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label><button type="button" onClick={() => void submitClose()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Close session</button></div>}{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</GlassPanel><DetailPanel title="Controls">Posting, voiding, closing, and reconciliation rules remain in existing cash services.</DetailPanel></>} /></div>;
}
