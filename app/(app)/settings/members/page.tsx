"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton, GlassErrorState } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";

const ROLES = ["ADMIN", "ACCOUNTANT", "EDITOR", "CASHIER", "VIEWER"];

async function api(path: string, method: string, body?: unknown) {
  const init: RequestInit = { method, credentials: "include", headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const members = useListQuery<any[]>("/api/settings/members", ["list", "settings-members"]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ msg: string; onOk: () => void } | null>(null);

  if (members.isLoading) return <GlassSkeleton className="h-72" />;
  if (members.error) return <GlassErrorState title="Members tidak tersedia" description="Tidak dapat memuat daftar member." />;

  const list: any[] = (members.data as any)?.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["list", "settings-members"] });

  const rows = list.map((m: any) => ({
    id: m.id,
    name: m.user?.name ?? "—",
    email: m.user?.email ?? "—",
    role: m.role,
    status: m.isActive ? "Aktif" : "Nonaktif",
    platform: m.user?.platformRole ?? "USER",
  }));

  async function invite() {
    if (!name || !email) { toast.error("Nama dan email wajib."); return; }
    setBusy(true);
    try {
      await api("/api/settings/members", "POST", { name, email, password: password || undefined, role });
      toast.success(`${email} berhasil ditambahkan sebagai ${role}.`);
      setName(""); setEmail(""); setPassword("");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  async function changeRole(id: string, newRole: string) {
    setBusy(true);
    try {
      await api(`/api/settings/members/${id}`, "PATCH", { role: newRole });
      toast.success("Role diperbarui.");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
    finally { setBusy(false); }
  }

  function deactivate(id: string) {
    setConfirmDialog({
      msg: "Nonaktifkan member ini?",
      onOk: async () => {
        setBusy(true);
        try {
          await api(`/api/settings/members/${id}`, "DELETE");
          toast.success("Member dinonaktifkan.");
          refresh();
        } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal."); }
        finally { setBusy(false); }
      },
    });
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="Settings" title="Anggota Tim" description="Kelola akses pengguna ke usaha ini. OWNER dapat mengundang dan mengubah role." />
      {confirmDialog ? (
        <GlassPanel className="grid gap-3">
          <p className="text-sm">{confirmDialog.msg}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { void confirmDialog.onOk(); setConfirmDialog(null); }} className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background">Ya, lanjutkan</button>
            <button type="button" onClick={() => setConfirmDialog(null)} className="h-9 rounded-md border border-border px-4 text-sm">Batal</button>
          </div>
        </GlassPanel>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <GlassTable
          tableId="settings-members"
          columns={[
            { key: "name", header: "Nama" },
            { key: "email", header: "Email" },
            { key: "role", header: "Role" },
            { key: "status", header: "Status" },
            {
              key: "actions",
              header: "Aksi",
              render: (row: any) => {
                const m = list.find((x) => x.id === row.id);
                if (!m || m.role === "OWNER") return <span className="text-xs text-muted">—</span>;
                return (
                  <div className="flex items-center gap-2">
                    <GlassDataSelect
                      value={m.role}
                      disabled={busy}
                      onChange={(v) => changeRole(m.id, v)}
                      options={ROLES.map((r) => ({ value: r, label: r }))}
                      className="h-7 text-xs"
                    />
                    {m.isActive ? (
                      <button type="button" disabled={busy} onClick={() => deactivate(m.id)} className="h-7 rounded border border-border px-2 text-xs text-danger disabled:opacity-40">Nonaktif</button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
          rows={rows}
          empty="Belum ada anggota tim."
        />

        <GlassPanel className="grid gap-4 self-start">
          <h2 className="text-sm font-semibold">Undang anggota baru</h2>
          <label className="grid gap-1 text-xs">Nama<GlassInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" className="h-9" /></label>
          <label className="grid gap-1 text-xs">Email<GlassInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" className="h-9" /></label>
          <label className="grid gap-1 text-xs">Password (opsional — diacak bila kosong)<GlassInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 karakter" className="h-9" /></label>
          <label className="grid gap-1 text-xs">Role
            <GlassDataSelect value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: r }))} className="h-9" />
          </label>
          <button type="button" onClick={invite} disabled={busy || !name || !email} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">
            {busy ? "Memproses…" : "Undang"}
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}
