"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassSkeleton, GlassErrorState } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { apiRequest } from "@/presentation/api/client";
import { useActiveBusiness } from "@/presentation/query/report-hooks";
import { GlassDataSelect } from "@/components/forms/glass-form";

const PLATFORM_ROLES = ["USER", "SUPPORT_AGENT", "FINANCE_ADMIN", "DEVELOPER", "SUPER_ADMIN"];

async function patchRole(userId: string, platformRole: string) {
  const res = await fetch(`/api/admin/users/${userId}/platform-role`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ platformRole }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || "Gagal.");
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const { data: biz } = useActiveBusiness();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => apiRequest<{ data: any[] }>("/api/admin/users") });
  const businesses = useQuery({ queryKey: ["admin", "businesses"], queryFn: () => apiRequest<{ data: any[] }>("/api/admin/businesses") });

  const [tab, setTab] = useState<"users" | "businesses">("users");
  const [busy, setBusy] = useState(false);

  if (users.isLoading) return <GlassSkeleton className="h-72" />;
  if (users.error) return <GlassErrorState title="God Mode tidak tersedia" description="Akses ditolak atau tidak ada koneksi." />;

  const userList: any[] = (users.data as any)?.data ?? [];
  const bizList: any[] = (businesses.data as any)?.data ?? [];

  async function handleRoleChange(userId: string, newRole: string) {
    setBusy(true);
    try {
      await patchRole(userId, newRole);
      toast.success("Platform role diperbarui.");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  async function handleForceLogout(userId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/sessions`, { method: "DELETE", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || json?.message || "Gagal.");
      toast.success(`Semua sesi user diakhiri.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  const userRows = userList.map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    platform: u.platformRole,
    businesses: (u.memberships ?? []).filter((m: any) => m.isActive).length,
    verified: u.emailVerified ? "✓" : "—",
  }));

  const bizRows = bizList.map((b: any) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    status: b.status,
    members: (b.members ?? []).filter((m: any) => m.isActive).length,
    owner: (b.members ?? []).find((m: any) => m.role === "OWNER")?.user?.email ?? "—",
  }));

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="God Mode" title="Admin Panel" description={`Akses platform level. Login sebagai: ${biz?.name ?? "—"}`} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("users")} className={`h-9 rounded-md px-4 text-sm font-medium ${tab === "users" ? "bg-foreground text-background" : "border border-border"}`}>Pengguna ({userList.length})</button>
        <button type="button" onClick={() => setTab("businesses")} className={`h-9 rounded-md px-4 text-sm font-medium ${tab === "businesses" ? "bg-foreground text-background" : "border border-border"}`}>Usaha ({bizList.length})</button>
      </div>
      {tab === "users" ? (
        <GlassTable
          tableId="admin-users"
          columns={[
            { key: "name", header: "Nama" },
            { key: "email", header: "Email" },
            { key: "verified", header: "Verified" },
            { key: "businesses", header: "Usaha" },
            {
              key: "platform",
              header: "Platform Role",
              render: (row: any) => (
                <GlassDataSelect
                  value={row.platform}
                  disabled={busy}
                  onChange={(v) => handleRoleChange(row.id, v)}
                  options={PLATFORM_ROLES.map((r) => ({ value: r, label: r }))}
                  className="h-7 text-xs"
                />
              ),
            },
            {
              key: "actions",
              header: "Aksi",
              render: (row: any) => (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleForceLogout(row.id)}
                  className="h-7 rounded border border-danger/60 px-2 text-xs text-danger hover:bg-danger/5 disabled:opacity-40"
                >
                  Force logout
                </button>
              ),
            },
          ]}
          rows={userRows}
          empty="Belum ada pengguna."
        />
      ) : (
        <GlassTable
          tableId="admin-businesses"
          columns={[
            { key: "name", header: "Nama Usaha" },
            { key: "type", header: "Tipe" },
            { key: "status", header: "Status" },
            { key: "members", header: "Anggota Aktif" },
            { key: "owner", header: "Owner" },
          ]}
          rows={bizRows}
          empty="Belum ada usaha."
        />
      )}

      <GlassPanel>
        <p className="text-xs text-muted">God Mode — hanya untuk SUPER_ADMIN. Semua aksi dicatat di audit log platform.</p>
      </GlassPanel>
    </div>
  );
}
