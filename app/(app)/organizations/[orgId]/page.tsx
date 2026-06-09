"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton, GlassErrorState } from "@/components/feedback/glass-feedback";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";
import { apiRequest } from "@/presentation/api/client";
import { formatRupiah } from "@/presentation/format/number";

interface Unit { id: string; name: string; type: string }
interface Member { userId: string; role: string; name?: string; email?: string }
interface OrgDetail { id: string; name: string; type: string; units: Unit[]; members: Member[] }
interface Biz { id: string; name: string }

interface ComparisonRow { businessId: string; name: string; revenue: string; netProfit: string; marginBps: number; healthStatus: string }
interface ComparisonReport { units: ComparisonRow[]; totalRevenue: string; totalNetProfit: string; totalMarginBps: number }

const ROLE_OPTIONS = [
  { value: "ORG_OWNER", label: "Owner" },
  { value: "ORG_ADMIN", label: "Admin" },
  { value: "ORG_VIEWER", label: "Viewer" },
];
const HEALTH_LABEL: Record<string, { label: string; cls: string }> = {
  HEALTHY: { label: "🟢 Sehat", cls: "text-success" },
  WATCH: { label: "🟡 Perlu Perhatian", cls: "text-warning" },
  CRITICAL: { label: "🔴 Kritis", cls: "text-danger" },
  NO_DATA: { label: "— Tanpa Data", cls: "text-muted" },
};

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method, credentials: "include",
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || "Gagal.");
  return json?.data ?? json;
}

export default function Page() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["organizations", orgId],
    queryFn: () => apiRequest<{ data: OrgDetail }>(`/api/organizations/${orgId}`),
  });
  const myBiz = useQuery({
    queryKey: ["auth", "businesses"],
    queryFn: () => apiRequest<{ data: Biz[] }>("/api/auth/businesses"),
  });

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth())); // 0-11, atau "ALL"
  const [busy, setBusy] = useState(false);
  const [addBizId, setAddBizId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("ORG_VIEWER");
  const [comparison, setComparison] = useState<ComparisonReport | null>(null);

  const data = (detail.data as any)?.data as OrgDetail | undefined;
  const businesses: Biz[] = (myBiz.data as any)?.data ?? [];

  const attachable = useMemo(() => {
    const attachedIds = new Set((data?.units ?? []).map((u) => u.id));
    return businesses.filter((b) => !attachedIds.has(b.id));
  }, [businesses, data]);

  if (detail.isLoading) return <GlassSkeleton className="h-72" />;
  if (detail.error || !data) return <GlassErrorState title="Tidak tersedia" description="Organisasi tidak ditemukan atau Anda bukan anggota." />;

  function periodRange() {
    const y = Number(year);
    if (month === "ALL") {
      return { startsOn: `${y}-01-01`, endsOn: `${y}-12-31` };
    }
    const m = Number(month);
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { startsOn: iso(start), endsOn: iso(end) };
  }

  async function refresh() { void qc.invalidateQueries({ queryKey: ["organizations", orgId] }); }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); } finally { setBusy(false); }
  }

  async function addUnit() {
    if (!addBizId) return;
    await run(async () => {
      await call(`/api/organizations/${orgId}/units`, "POST", { businessId: addBizId });
      toast.success("Unit usaha ditambahkan.");
      setAddBizId("");
      await refresh();
    });
  }
  async function removeUnit(businessId: string) {
    await run(async () => {
      await call(`/api/organizations/${orgId}/units/${businessId}`, "DELETE");
      toast.success("Unit usaha dilepas.");
      await refresh();
    });
  }
  async function invite() {
    if (!inviteEmail) return;
    await run(async () => {
      await call(`/api/organizations/${orgId}/members`, "POST", { email: inviteEmail.trim(), role: inviteRole });
      toast.success("Anggota ditambahkan.");
      setInviteEmail(""); setInviteRole("ORG_VIEWER");
      await refresh();
    });
  }
  async function changeRole(userId: string, role: string) {
    await run(async () => {
      await call(`/api/organizations/${orgId}/members/${userId}`, "PATCH", { role });
      toast.success("Peran anggota diperbarui.");
      await refresh();
    });
  }
  async function removeMember(userId: string) {
    await run(async () => {
      await call(`/api/organizations/${orgId}/members/${userId}`, "DELETE");
      toast.success("Anggota dikeluarkan.");
      await refresh();
    });
  }
  async function loadComparison() {
    await run(async () => {
      const report = await call(`/api/organizations/${orgId}/reports/unit-comparison`, "POST", periodRange());
      setComparison(report as ComparisonReport);
    });
  }

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => ({ value: String(y), label: String(y) }));
  const monthOptions = [{ value: "ALL", label: "Setahun penuh" }, ...MONTHS.map((m, i) => ({ value: String(i), label: m }))];

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow={data.type} title={data.name} description="Kelola unit usaha, anggota, dan laporan konsolidasi." />

      {/* Unit usaha */}
      <GlassPanel className="grid gap-4">
        <h2 className="text-sm font-semibold">Unit Usaha ({data.units.length})</h2>
        <div className="grid gap-2">
          {data.units.length === 0 && <p className="text-xs text-muted">Belum ada unit usaha tergabung.</p>}
          {data.units.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <div><p className="text-sm font-medium">{u.name}</p><p className="text-[11px] text-muted">{u.type}</p></div>
              <button type="button" disabled={busy} onClick={() => removeUnit(u.id)} className="h-7 rounded border border-danger/60 px-2 text-xs text-danger hover:bg-danger/5 disabled:opacity-40">Lepas</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border/40 pt-3">
          <label className="grid flex-1 gap-1 text-xs">Tambah unit (dari usaha Anda)
            <GlassDataSelect value={addBizId} onChange={setAddBizId} placeholder="Pilih usaha…" options={attachable.map((b) => ({ value: b.id, label: b.name }))} className="h-9" />
          </label>
          <button type="button" disabled={busy || !addBizId} onClick={addUnit} className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">Tambah</button>
        </div>
      </GlassPanel>

      {/* Anggota */}
      <GlassPanel className="grid gap-4">
        <h2 className="text-sm font-semibold">Anggota Organisasi ({data.members.length})</h2>
        <div className="grid gap-2">
          {data.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{m.name ?? m.userId}</p><p className="truncate text-[11px] text-muted">{m.email}</p></div>
              <div className="flex items-center gap-2">
                <GlassDataSelect value={m.role} disabled={busy} onChange={(v) => changeRole(m.userId, v)} options={ROLE_OPTIONS} className="h-7 text-xs" />
                <button type="button" disabled={busy} onClick={() => removeMember(m.userId)} className="h-7 rounded border border-danger/60 px-2 text-xs text-danger hover:bg-danger/5 disabled:opacity-40">Hapus</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border/40 pt-3">
          <label className="grid flex-1 gap-1 text-xs">Undang via email
            <GlassInput value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@pengguna.com" className="h-9" />
          </label>
          <label className="grid gap-1 text-xs">Peran
            <GlassDataSelect value={inviteRole} onChange={setInviteRole} options={ROLE_OPTIONS} className="h-9" />
          </label>
          <button type="button" disabled={busy || !inviteEmail} onClick={invite} className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">Undang</button>
        </div>
      </GlassPanel>

      {/* Laporan konsolidasi */}
      <GlassPanel className="grid gap-4">
        <h2 className="text-sm font-semibold">Perbandingan & Konsolidasi Unit</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs">Tahun
            <GlassDataSelect value={year} onChange={setYear} options={years} className="h-9" />
          </label>
          <label className="grid gap-1 text-xs">Periode
            <GlassDataSelect value={month} onChange={setMonth} options={monthOptions} className="h-9" />
          </label>
          <button type="button" disabled={busy} onClick={loadComparison} className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-40">
            {busy ? "Memuat…" : "Tampilkan"}
          </button>
        </div>

        {comparison && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Unit Usaha</th>
                  <th className="py-2 pr-3 text-right font-medium">Pendapatan</th>
                  <th className="py-2 pr-3 text-right font-medium">Laba Bersih</th>
                  <th className="py-2 pr-3 text-right font-medium">Margin</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {comparison.units.map((u) => {
                  const h = HEALTH_LABEL[u.healthStatus] ?? HEALTH_LABEL.NO_DATA;
                  return (
                    <tr key={u.businessId} className="border-b border-border/40">
                      <td className="py-2 pr-3">{u.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(BigInt(u.revenue))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(BigInt(u.netProfit))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{(u.marginBps / 100).toFixed(1)}%</td>
                      <td className={`py-2 ${h!.cls}`}>{h!.label}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 pr-3">TOTAL</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(BigInt(comparison.totalRevenue))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(BigInt(comparison.totalNetProfit))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{(comparison.totalMarginBps / 100).toFixed(1)}%</td>
                  <td className="py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
