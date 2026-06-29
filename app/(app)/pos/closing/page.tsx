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
import { GlassDataSelect, GlassInput, GlassDateTimePicker } from "@/components/forms/glass-form";

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const sessions = useListQuery<any[]>("/api/pos/sessions", ["list", "pos-sessions"]);

  const [sessionId, setSessionId] = useState("");
  const [closedAt, setClosedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [closingAmount, setClosingAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (sessions.isLoading) return <GlassSkeleton className="h-72" />;
  if (sessions.error) return <GlassErrorState title="POS sessions tidak tersedia" description="Tidak dapat memuat sesi POS." />;

  const allSessions: any[] = (sessions.data as any)?.data ?? [];
  const openSessions = allSessions.filter((s) => s.status === "OPEN");
  const closedSessions = allSessions.filter((s) => s.status !== "OPEN");

  const rows = closedSessions.map((s: any) => ({
    id: s.id.slice(-8),
    terminal: s.terminalId?.slice(-6) ?? "—",
    opened: String(s.openedAt).slice(0, 16),
    closed: s.closedAt ? String(s.closedAt).slice(0, 16) : "—",
    opening: formatRupiah(s.openingCashAmount ?? 0),
    closing: s.closingCashAmount != null ? formatRupiah(s.closingCashAmount) : "—",
  }));

  async function handleClose() {
    if (!sessionId) { toast.error("Pilih sesi yang mau ditutup."); return; }
    setBusy(true);
    try {
      await postJson("/api/pos/sessions/close", {
        sessionId,
        closedAt: new Date(closedAt).toISOString(),
        ...(closingAmount ? { closingCashAmount: Number(closingAmount) } : {}),
      });
      toast.success("Sesi POS berhasil ditutup.");
      setSessionId(""); setClosingAmount("");
      void qc.invalidateQueries({ queryKey: ["list", "pos-sessions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menutup sesi.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="POS" title="Tutup Kasir" description="Tutup sesi POS aktif, catat jumlah kas terhitung, dan posting selisih melalui CashService." />
      <SplitWorkspace
        main={<GlassTable columns={[{ key: "id", header: "ID" }, { key: "terminal", header: "Terminal" }, { key: "opened", header: "Dibuka" }, { key: "closed", header: "Ditutup" }, { key: "opening", header: "Modal Awal" }, { key: "closing", header: "Kas Akhir" }]} rows={rows} empty="Belum ada sesi yang ditutup." />}
        side={
          <GlassPanel className="grid gap-4">
            <h2 className="text-sm font-semibold">Tutup sesi</h2>
            <label className="grid gap-1 text-xs">
              Sesi aktif
              <GlassDataSelect
                value={sessionId}
                onChange={setSessionId}
                placeholder={openSessions.length ? "Pilih sesi" : "Tidak ada sesi terbuka"}
                options={openSessions.map((s: any) => ({ value: s.id, label: `${s.id.slice(-8)} · dibuka ${String(s.openedAt).slice(0, 16)}` }))}
                className="h-9"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Ditutup pada
              <GlassDateTimePicker value={closedAt} onChange={setClosedAt} className="h-9" />
            </label>
            <label className="grid gap-1 text-xs">
              Jumlah kas terhitung (opsional)
              <GlassInput type="number" min={0} value={closingAmount} onChange={(e) => setClosingAmount(e.target.value)} placeholder="0" className="h-9" />
            </label>
            <button type="button" onClick={handleClose} disabled={busy || !sessionId} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">
              {busy ? "Menutup…" : "Tutup sesi"}
            </button>
            <DetailPanel title="Selisih kas">Jika jumlah kas terhitung berbeda dari ekspektasi, CashService akan posting jurnal selisih secara otomatis.</DetailPanel>
          </GlassPanel>
        }
      />
    </div>
  );
}
