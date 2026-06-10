"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { GlassDataSelect, GlassDateTimePicker, GlassInput } from "@/components/forms/glass-form";

const now = () => new Date().toISOString().slice(0, 16);
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const mutation = usePostMutation("/api/cash/sessions");
  const list = useListQuery<any[]>("/api/cash/sessions", ["list", "cash-sessions"]);
  const drawers = useListQuery<any[]>("/api/cash/drawers", ["list", "cash-drawers"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const [mode, setMode] = useState<"open" | "close" | "drawers">("open");

  // Session state
  const [drawerId, setDrawerId] = useState("");
  const [openedAt, setOpenedAt] = useState(now);
  const [openingAmount, setOpeningAmount] = useState("");
  const [equityAccountId, setEquityAccountId] = useState("");
  const [shiftCode, setShiftCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [closedAt, setClosedAt] = useState(now);
  const [countedAmount, setCountedAmount] = useState("");
  const [differenceAccountId, setDifferenceAccountId] = useState("");

  // Drawer state
  const [drawerName, setDrawerName] = useState("");
  const [drawerCashAccountId, setDrawerCashAccountId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const cashAccounts = flat.filter((a: any) => (a.subtype === "cash" || a.subtype === "bank") && a.isPostingAllowed);
  const equityAccounts = flat.filter((a: any) => a.groupCode === 3 && a.isPostingAllowed);
  const expenseAccounts = flat.filter((a: any) => (a.groupCode === 6 || a.groupCode === 7) && a.isPostingAllowed);
  const drawerList: any[] = (drawers.data as any)?.data ?? [];
  const sessions: any[] = ((list.data as any)?.data ?? []);
  const openSessions = sessions.filter((s: any) => s.status === "OPEN");

  if (list.isLoading || drawers.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Cash sessions unavailable" description="Unable to load cash sessions." />;

  const msg = (ok: boolean, text: string) => { setOkMsg(ok ? text : null); setError(ok ? null : text); };

  async function submitOpen() {
    if (!drawerId) { msg(false, "Pilih cash drawer."); return; }
    if (!equityAccountId) { msg(false, "Pilih akun equity/modal."); return; }
    setBusy(true);
    try {
      await mutation.mutateAsync({ drawerId, openedAt, openingAmount: openingAmount || "0", equityAccountId, shiftCode: shiftCode || undefined });
      msg(true, "Sesi kas dibuka."); setDrawerId(""); setOpeningAmount(""); setShiftCode("");
    } catch (e) { msg(false, e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  async function submitClose() {
    if (!sessionId) { msg(false, "Pilih sesi yang mau ditutup."); return; }
    if (!differenceAccountId) { msg(false, "Pilih akun selisih."); return; }
    setBusy(true);
    try {
      await mutation.mutateAsync({ sessionId, closedAt, countedAmount: countedAmount || "0", differenceAccountId });
      msg(true, "Sesi kas ditutup."); setSessionId(""); setCountedAmount("");
    } catch (e) { msg(false, e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  async function createDrawer() {
    if (!drawerName.trim()) { msg(false, "Nama drawer wajib diisi."); return; }
    if (!drawerCashAccountId) { msg(false, "Pilih akun kas untuk drawer."); return; }
    setBusy(true);
    try {
      await postJson("/api/cash/drawers", { name: drawerName.trim(), cashAccountId: drawerCashAccountId });
      msg(true, `Drawer "${drawerName.trim()}" dibuat.`);
      setDrawerName(""); setDrawerCashAccountId("");
      void qc.invalidateQueries({ queryKey: ["list", "cash-drawers"] });
    } catch (e) { msg(false, e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  const rows = sessions.map((s: any) => ({
    drawer: drawerList.find((d) => d.id === s.drawerId)?.name ?? s.drawerId?.slice(-6) ?? "—",
    status: s.status,
    opened: String(s.openedAt).slice(0, 16),
    closed: s.closedAt ? String(s.closedAt).slice(0, 16) : "—",
    opening: s.openingAmount != null ? formatRupiah(s.openingAmount) : "—",
  }));

  const tabBtn = (t: typeof mode, label: string) =>
    <button type="button" onClick={() => { setMode(t); setError(null); setOkMsg(null); }} className={`h-9 rounded-md px-3 text-sm font-medium ${mode === t ? "bg-foreground text-background" : "border border-border"}`}>{label}</button>;

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="Cash Management" title="Cash Sessions" description="Buka dan tutup sesi kas untuk setiap cash drawer. Posting jurnal pembukaan/penutupan otomatis." />
      <SplitWorkspace
        main={<GlassTable columns={[{ key: "drawer", header: "Drawer" }, { key: "status", header: "Status" }, { key: "opened", header: "Dibuka" }, { key: "closed", header: "Ditutup" }, { key: "opening", header: "Modal Awal" }]} rows={rows} empty="Belum ada sesi kas." />}
        side={
          <GlassPanel className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {tabBtn("open", "Buka sesi")}
              {tabBtn("close", "Tutup sesi")}
              {tabBtn("drawers", `Drawer (${drawerList.length})`)}
            </div>

            {mode === "open" && (
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs">Cash drawer<GlassDataSelect value={drawerId} onChange={setDrawerId} placeholder={drawerList.length ? "Pilih drawer" : "Belum ada drawer"} options={drawerList.map((d: any) => ({ value: d.id, label: d.name }))} className="h-9" /></label>
                <label className="grid gap-1 text-xs">Dibuka pada<GlassDateTimePicker value={openedAt} onChange={setOpenedAt} className="h-9" /></label>
                <label className="grid gap-1 text-xs">Modal awal<GlassInput value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="0" className="h-9" /></label>
                <label className="grid gap-1 text-xs">Akun equity/modal<GlassDataSelect value={equityAccountId} onChange={setEquityAccountId} placeholder="Pilih akun" options={equityAccounts.map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-9" /></label>
                <label className="grid gap-1 text-xs">Kode shift (opsional)<GlassInput value={shiftCode} onChange={(e) => setShiftCode(e.target.value)} placeholder="PAGI" className="h-9" /></label>
                <button type="button" disabled={busy || !drawerId} onClick={() => void submitOpen()} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">Buka sesi</button>
              </div>
            )}

            {mode === "close" && (
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs">Sesi terbuka<GlassDataSelect value={sessionId} onChange={setSessionId} placeholder={openSessions.length ? "Pilih sesi" : "Tidak ada sesi terbuka"} options={openSessions.map((s: any) => ({ value: s.id, label: `${s.id.slice(-8)} · ${String(s.openedAt).slice(0, 16)}` }))} className="h-9" /></label>
                <label className="grid gap-1 text-xs">Ditutup pada<GlassDateTimePicker value={closedAt} onChange={setClosedAt} className="h-9" /></label>
                <label className="grid gap-1 text-xs">Jumlah kas terhitung<GlassInput value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} placeholder="0" className="h-9" /></label>
                <label className="grid gap-1 text-xs">Akun selisih<GlassDataSelect value={differenceAccountId} onChange={setDifferenceAccountId} placeholder="Pilih akun" options={expenseAccounts.map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-9" /></label>
                <button type="button" disabled={busy || !sessionId} onClick={() => void submitClose()} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">Tutup sesi</button>
              </div>
            )}

            {mode === "drawers" && (
              <div className="grid gap-3">
                {drawerList.length > 0 && (
                  <ul className="grid gap-1">
                    {drawerList.map((d: any) => (
                      <li key={d.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                        <span className="font-medium">{d.name}</span>
                        <span className="text-xs text-muted">{cashAccounts.find((a) => a.id === d.cashAccountId)?.code ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs font-medium text-muted">Buat drawer baru</p>
                <label className="grid gap-1 text-xs">Nama drawer<GlassInput value={drawerName} onChange={(e) => setDrawerName(e.target.value)} placeholder="cth: Kasir Utama" className="h-9" /></label>
                <label className="grid gap-1 text-xs">Akun kas<GlassDataSelect value={drawerCashAccountId} onChange={setDrawerCashAccountId} placeholder="Pilih akun kas/bank" options={cashAccounts.map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-9" /></label>
                <button type="button" disabled={busy || !drawerName.trim() || !drawerCashAccountId} onClick={() => void createDrawer()} className="h-9 rounded-md border border-border text-sm font-medium disabled:opacity-40">Buat drawer</button>
              </div>
            )}

            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            {okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}
            <DetailPanel title="Jurnal otomatis">Buka sesi mendebit kas dari akun equity. Tutup sesi memposting selisih ke akun beban jika ada.</DetailPanel>
          </GlassPanel>
        }
      />
    </div>
  );
}
