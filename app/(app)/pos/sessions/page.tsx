"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { GlassDataSelect, GlassDateTimePicker, GlassInput } from "@/components/forms/glass-form";

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const sessions = useListQuery<any[]>("/api/pos/sessions", ["list", "pos-sessions"]);
  const terminals = useListQuery<any[]>("/api/pos/terminals", ["list", "pos-terminals"]);
  const drawers = useListQuery<any[]>("/api/cash/drawers", ["list", "cash-drawers"]);

  // Buka sesi
  const [terminalId, setTerminalId] = useState("");
  const [openedAt, setOpenedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [openingAmount, setOpeningAmount] = useState("");

  // Buat terminal
  const [terminalName, setTerminalName] = useState("");
  const [drawerId, setDrawerId] = useState("");

  const [busy, setBusy] = useState(false);

  if (sessions.isLoading || terminals.isLoading) return <GlassSkeleton className="h-72" />;
  if (sessions.error) return <GlassErrorState title="POS sessions tidak tersedia" description="Tidak dapat memuat sesi POS." />;

  const allSessions: any[] = (sessions.data as any)?.data ?? [];
  const terminalList: any[] = (terminals.data as any)?.data ?? [];
  const drawerList: any[] = (drawers.data as any)?.data ?? [];

  const rows = allSessions.map((s: any) => ({
    id: s.id.slice(-8),
    terminal: terminalList.find((t) => t.id === s.terminalId)?.name ?? s.terminalId?.slice(-6) ?? "—",
    opened: String(s.openedAt).slice(0, 16),
    expected: s.expectedCashAmount != null ? formatRupiah(s.expectedCashAmount) : "—",
    status: s.status,
  }));

  async function handleOpenSession() {
    if (!terminalId) { toast.error("Pilih terminal."); return; }
    setBusy(true);
    try {
      await postJson("/api/pos/sessions", {
        terminalId,
        openedAt: new Date(openedAt).toISOString(),
        ...(openingAmount ? { openingCashAmount: Number(openingAmount) } : {}),
      });
      toast.success("Sesi POS dibuka.");
      setOpeningAmount("");
      void qc.invalidateQueries({ queryKey: ["list", "pos-sessions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally { setBusy(false); }
  }

  async function handleCreateTerminal() {
    if (!terminalName.trim()) { toast.error("Nama terminal wajib diisi."); return; }
    setBusy(true);
    try {
      await postJson("/api/pos/terminals", {
        name: terminalName.trim(),
        ...(drawerId ? { cashDrawerId: drawerId } : {}),
      });
      toast.success(`Terminal "${terminalName.trim()}" dibuat.`);
      setTerminalName(""); setDrawerId("");
      void qc.invalidateQueries({ queryKey: ["list", "pos-terminals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat terminal.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="POS" title="POS Sessions" description="Buka dan pantau sesi kasir. Setiap sesi terhubung ke terminal POS." />
      <SplitWorkspace
        main={<GlassTable columns={[{ key: "id", header: "ID" }, { key: "terminal", header: "Terminal" }, { key: "opened", header: "Dibuka" }, { key: "expected", header: "Ekspektasi Kas" }, { key: "status", header: "Status" }]} rows={rows} empty="Belum ada sesi POS." />}
        side={
          <div className="grid gap-4">
            <GlassPanel className="grid gap-4">
              <h2 className="text-sm font-semibold">Buka sesi baru</h2>
              <label className="grid gap-1 text-xs">
                Terminal
                <GlassDataSelect
                  value={terminalId}
                  onChange={setTerminalId}
                  placeholder={terminalList.length ? "Pilih terminal" : "Belum ada terminal"}
                  options={terminalList.map((t: any) => ({ value: t.id, label: t.name }))}
                  className="h-9"
                />
              </label>
              <label className="grid gap-1 text-xs">
                Dibuka pada
                <GlassDateTimePicker value={openedAt} onChange={setOpenedAt} className="h-9" />
              </label>
              <label className="grid gap-1 text-xs">
                Modal awal kas (opsional)
                <GlassInput type="number" min={0} value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="0" className="h-9" />
              </label>
              <button type="button" onClick={handleOpenSession} disabled={busy || !terminalId} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">
                {busy ? "Membuka…" : "Buka sesi"}
              </button>
            </GlassPanel>

            <GlassPanel className="grid gap-4">
              <h2 className="text-sm font-semibold">Terminal ({terminalList.length})</h2>
              {terminalList.length > 0 ? (
                <ul className="grid gap-1">
                  {terminalList.map((t: any) => (
                    <li key={t.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                      <span>{t.name}</span>
                      {t.cashDrawerId ? <span className="text-xs text-muted">+ drawer</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className="grid gap-1 text-xs">
                Nama terminal baru
                <GlassInput value={terminalName} onChange={(e) => setTerminalName(e.target.value)} placeholder="cth: Kasir 1" className="h-9" />
              </label>
              {drawerList.length > 0 ? (
                <label className="grid gap-1 text-xs">
                  Cash drawer (opsional)
                  <GlassDataSelect
                    value={drawerId}
                    onChange={setDrawerId}
                    placeholder="Tanpa drawer"
                    options={drawerList.map((d: any) => ({ value: d.id, label: d.name ?? d.id.slice(-6) }))}
                    className="h-9"
                  />
                </label>
              ) : null}
              <button type="button" onClick={handleCreateTerminal} disabled={busy || !terminalName.trim()} className="h-9 rounded-md border border-border px-4 text-sm font-medium disabled:opacity-40">
                {busy ? "Membuat…" : "Buat terminal"}
              </button>
            </GlassPanel>

            <DetailPanel title="Cash drawer link">Membuka sesi POS mendelegasikan ke CashService jika terminal punya cash drawer terhubung.</DetailPanel>
          </div>
        }
      />
    </div>
  );
}
