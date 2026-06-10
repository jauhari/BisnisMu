"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton, GlassErrorState } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassInput } from "@/components/forms/glass-form";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

const TYPE_OPTIONS = [
  { value: "CUSTOMER", label: "Pelanggan", color: "bg-accent/12 text-accent" },
  { value: "SUPPLIER", label: "Pemasok", color: "bg-purple-500/12 text-purple-600" },
  { value: "BOTH", label: "Pelanggan & Pemasok", color: "bg-success/12 text-success" },
  { value: "OTHER", label: "Lainnya", color: "bg-muted/20 text-muted" },
];

const typeLabel = (t: string) => TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
const typeColor = (t: string) => TYPE_OPTIONS.find((o) => o.value === t)?.color ?? "";

async function apiJson(path: string, method: string, body?: unknown) {
  const init: RequestInit = { method, credentials: "include", headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

type Mode = "add" | "edit";

export default function Page() {
  const qc = useQueryClient();
  const contacts = useListQuery<any[]>("/api/contacts", ["list", "contacts"]);

  const [mode, setMode] = useState<Mode>("add");
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("CUSTOMER");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [npwp, setNpwp] = useState("");

  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  if (contacts.isLoading) return <GlassSkeleton className="h-72" />;
  if (contacts.error) return <GlassErrorState title="Kontak tidak tersedia" description="Tidak dapat memuat daftar kontak." />;

  const list: any[] = (contacts.data as any)?.data ?? [];
  const filtered = filter === "ALL" ? list : list.filter((c) => c.type === filter);

  const refresh = () => qc.invalidateQueries({ queryKey: ["list"] });

  function startEdit(contact: any) {
    setMode("edit");
    setEditId(contact.id);
    setName(contact.name ?? "");
    setType(contact.type ?? "CUSTOMER");
    setPhone(contact.phone ?? "");
    setEmail(contact.email ?? "");
    setAddress(contact.address ?? "");
    setNpwp(contact.npwpNumber ?? "");
  }

  function startAdd() {
    setMode("add");
    setEditId(null);
    setName(""); setType("CUSTOMER"); setPhone(""); setEmail(""); setAddress(""); setNpwp("");
  }

  async function save() {
    if (!name.trim()) { toast.error("Nama wajib diisi."); return; }
    setBusy(true);
    try {
      if (mode === "add") {
        const result = await apiJson("/api/contacts", "POST", {
          name: name.trim(), type, phone: phone || undefined, email: email || undefined,
          address: address || undefined, npwpNumber: npwp || undefined,
        });
        const extra = [];
        if (result.data?.customer) extra.push("Pelanggan");
        if (result.data?.vendor) extra.push("Pemasok");
        toast.success(`${name} disimpan${extra.length ? ` → juga dibuat sebagai ${extra.join(" & ")}` : ""}.`);
        setName(""); setPhone(""); setEmail(""); setAddress(""); setNpwp("");
      } else {
        await apiJson(`/api/contacts/${editId}`, "PATCH", {
          name: name.trim(), type,
          phone: phone || null, email: email || null,
          address: address || null,
        });
        toast.success(`${name} berhasil diperbarui.`);
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setBusy(true);
    try {
      await apiJson(`/api/contacts/${deleteConfirm.id}`, "DELETE");
      toast.success(`${deleteConfirm.name} dinonaktifkan.`);
      setDeleteConfirm(null);
      if (editId === deleteConfirm.id) startAdd();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally { setBusy(false); }
  }

  const rows = filtered.map((c: any) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    phone: c.phone ?? "—",
    email: c.email ?? "—",
    address: c.address ?? "—",
    _raw: c,
  }));

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Master Data"
        title="Kontak"
        description="Satu kontak bisa jadi Pelanggan, Pemasok, atau keduanya sekaligus. Otomatis sinkron ke tabel pelanggan dan pemasok."
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "ALL", label: `Semua (${list.length})` }, ...TYPE_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} (${list.filter((c) => c.type === o.value).length})` }))].map((opt) => (
          <button key={opt.value} type="button" onClick={() => setFilter(opt.value)}
            className={`h-8 rounded-full px-3 text-sm transition ${filter === opt.value ? "bg-foreground text-background" : "border border-border hover:bg-white/60 dark:hover:bg-white/10"}`}>
            {opt.label}
          </button>
        ))}
      </div>

      <SplitWorkspace
        main={
          <GlassTable
            tableId="contacts"
            columns={[
              { key: "name", header: "Nama" },
              {
                key: "type", header: "Tipe",
                render: (row: any) => (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor(row.type)}`}>{typeLabel(row.type)}</span>
                ),
              },
              { key: "phone", header: "Telepon" },
              { key: "email", header: "Email" },
              {
                key: "actions", header: "",
                render: (row: any) => (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(row._raw)}
                      className={`h-7 rounded-md border px-2 text-xs transition ${editId === row.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-white/60 dark:hover:bg-white/10"}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ id: row.id, name: row.name })}
                      className="h-7 rounded-md border border-danger/50 px-2 text-xs text-danger hover:bg-danger/5"
                    >
                      Hapus
                    </button>
                  </div>
                ),
              },
            ]}
            rows={rows}
            empty="Belum ada kontak. Tambahkan di sebelah kanan."
          />
        }
        side={
          <div className="grid gap-4">
            {/* Delete confirm dialog */}
            {deleteConfirm && (
              <GlassPanel className="grid gap-3 border-danger/40 bg-danger/5">
                <p className="text-sm font-medium">Nonaktifkan kontak?</p>
                <p className="text-xs text-muted"><strong>{deleteConfirm.name}</strong> akan dinonaktifkan dan tidak muncul di daftar.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={confirmDelete} disabled={busy} className="h-8 rounded-md bg-danger px-3 text-xs font-medium text-white disabled:opacity-50">
                    {busy ? "Menghapus…" : "Ya, nonaktifkan"}
                  </button>
                  <button type="button" onClick={() => setDeleteConfirm(null)} className="h-8 rounded-md border border-border px-3 text-xs">
                    Batal
                  </button>
                </div>
              </GlassPanel>
            )}

            <GlassPanel className="grid gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {mode === "edit" ? `Edit: ${name || "Kontak"}` : "Tambah kontak baru"}
                </h2>
                {mode === "edit" && (
                  <button type="button" onClick={startAdd} className="text-xs text-accent underline">
                    + Baru
                  </button>
                )}
              </div>

              <label className="grid gap-1 text-xs">
                Tipe kontak
                <div className="grid grid-cols-2 gap-1.5">
                  {TYPE_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setType(opt.value)}
                      className={`h-9 rounded-md border text-xs font-medium transition ${type === opt.value ? "border-foreground bg-foreground text-background" : "border-border hover:bg-white/60 dark:hover:bg-white/8"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </label>

              {mode === "add" && (type === "BOTH" ? (
                <div className="rounded-md border border-success/40 bg-success/8 px-3 py-2 text-xs text-success">
                  ✓ Akan otomatis dibuat sebagai <strong>Pelanggan</strong> dan <strong>Pemasok</strong>
                </div>
              ) : type === "CUSTOMER" ? (
                <div className="rounded-md border border-accent/40 bg-accent/8 px-3 py-2 text-xs text-accent">
                  ✓ Akan otomatis dibuat sebagai <strong>Pelanggan</strong>
                </div>
              ) : type === "SUPPLIER" ? (
                <div className="rounded-md border border-purple-500/40 bg-purple-500/8 px-3 py-2 text-xs text-purple-600">
                  ✓ Akan otomatis dibuat sebagai <strong>Pemasok</strong>
                </div>
              ) : null)}

              <label className="grid gap-1 text-xs">Nama <span className="text-danger">*</span>
                <GlassInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap / perusahaan" className="h-9" />
              </label>
              <label className="grid gap-1 text-xs">Telepon
                <GlassInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812..." className="h-9" />
              </label>
              <label className="grid gap-1 text-xs">Email
                <GlassInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="h-9" />
              </label>
              <label className="grid gap-1 text-xs">Alamat
                <GlassInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. ..." className="h-9" />
              </label>
              <label className="grid gap-1 text-xs">NPWP (opsional)
                <GlassInput value={npwp} onChange={(e) => setNpwp(e.target.value)} placeholder="00.000.000.0-000.000" className="h-9" />
              </label>

              <button type="button" onClick={save} disabled={busy || !name.trim()} className="h-10 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-40">
                {busy ? "Menyimpan…" : mode === "edit" ? "Simpan perubahan" : "Simpan kontak"}
              </button>
            </GlassPanel>

            <DetailPanel title="Sinkronisasi otomatis">
              Kontak bertipe <strong>Pelanggan</strong> langsung bisa dipilih saat buat Invoice atau Sales Order. Tipe <strong>Pemasok</strong> langsung bisa dipilih di Bill. Tipe <strong>Keduanya</strong> berlaku untuk keduanya.
            </DetailPanel>
          </div>
        }
      />
    </div>
  );
}
