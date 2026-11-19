"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader, SplitWorkspace } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassDataSelect, GlassField, GlassInput } from "@/components/forms/glass-form";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
  { value: "RESIGNED", label: "Keluar" },
];

const statusLabel = (status: string) => STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

function toNum(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function rp(value: unknown): string {
  const n = toNum(value);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

async function apiJson(path: string, method: string, body?: unknown) {
  const init: RequestInit = { method, credentials: "include", headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Gagal (${res.status})`);
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const query = useListQuery<any[]>("/api/members", ["list", "members"]);
  const list: any[] = (query.data as any)?.data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberNumber, setMemberNumber] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () =>
      list.map((item) => {
        const savings = item.savings ?? {};
        const total = toNum(savings.POKOK) + toNum(savings.WAJIB) + toNum(savings.SUKARELA);
        return {
          id: item.member.id,
          memberNumber: item.member.memberNumber,
          name: item.member.name,
          phone: item.member.phone ?? "—",
          pokok: rp(savings.POKOK),
          wajib: rp(savings.WAJIB),
          sukarela: rp(savings.SUKARELA),
          total: rp(total),
          pinjaman: rp(item.loanOutstanding),
          status: item.member.status,
          jatuhTempo: item.overdueInstallments > 0 ? `${item.overdueInstallments} angsuran lewat tempo` : "—",
        };
      }),
    [list],
  );

  const grandTotal = useMemo(
    () =>
      list.reduce(
        (acc, item) =>
          acc +
          toNum(item.savings?.POKOK) +
          toNum(item.savings?.WAJIB) +
          toNum(item.savings?.SUKARELA),
        0,
      ),
    [list],
  );

  function resetForm() {
    setEditingId(null);
    setMemberNumber("");
    setName("");
    setPhone("");
    setAddress("");
    setStatus("ACTIVE");
  }

  function startEdit(row: any) {
    const raw = list.find((item) => item.member.id === row.id);
    if (!raw) return;
    setEditingId(raw.member.id);
    setMemberNumber(raw.member.memberNumber);
    setName(raw.member.name);
    setPhone(raw.member.phone ?? "");
    setAddress(raw.member.address ?? "");
    setStatus(raw.member.status);
  }

  async function save() {
    if (!memberNumber.trim() || !name.trim()) {
      toast.error("Nomor anggota dan nama wajib diisi");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        memberNumber: memberNumber.trim(),
        name: name.trim(),
        status,
      };
      if (phone.trim()) payload.phone = phone.trim();
      if (address.trim()) payload.address = address.trim();

      if (editingId) {
        await apiJson(`/api/members/${editingId}`, "PATCH", payload);
        toast.success("Anggota diperbarui");
      } else {
        await apiJson("/api/members", "POST", payload);
        toast.success("Anggota ditambahkan");
      }
      qc.invalidateQueries({ queryKey: ["list"] });
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan anggota");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Koperasi"
        title="Anggota"
        description="Simpanan pokok, wajib, sukarela, dan sisa pinjaman per anggota. Setiap transaksi otomatis membentuk jurnal."
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-border px-3 py-1">
          {list.length} anggota terdaftar
        </span>
        <span className="rounded-full border border-border px-3 py-1">
          Total simpanan {rp(grandTotal)}
        </span>
      </div>

      <SplitWorkspace
        main={
          <GlassTable
            tableId="members"
            columns={[
              { key: "memberNumber", header: "No" },
              { key: "name", header: "Nama" },
              { key: "pokok", header: "Simp. Pokok" },
              { key: "wajib", header: "Simp. Wajib" },
              { key: "sukarela", header: "Sukarela" },
              { key: "total", header: "Total Simpanan", sticky: true },
              { key: "pinjaman", header: "Sisa Pinjaman" },
              { key: "jatuhTempo", header: "Perhatian" },
              {
                key: "status",
                header: "Status",
                render: (row: any) => (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.status === "ACTIVE"
                        ? "bg-success/12 text-success"
                        : row.status === "RESIGNED"
                          ? "bg-danger/12 text-danger"
                          : "bg-muted/20 text-muted"
                    }`}
                  >
                    {statusLabel(row.status)}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                render: (row: any) => (
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/members/${row.id}`}
                      className="h-7 rounded-md border border-border px-2 text-xs leading-7 transition hover:bg-white/60 dark:hover:bg-white/10"
                    >
                      Kartu
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className={`h-7 rounded-md border px-2 text-xs transition ${
                        editingId === row.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-white/60 dark:hover:bg-white/10"
                      }`}
                    >
                      Edit
                    </button>
                  </div>
                ),
              },
            ]}
            rows={rows}
            empty="Belum ada anggota. Tambahkan di panel kanan."
          />
        }
        side={
          <GlassPanel className="grid gap-4">
            <div>
              <p className="text-sm font-semibold">{editingId ? "Ubah anggota" : "Anggota baru"}</p>
              <p className="text-xs text-muted">Nomor anggota unik per usaha.</p>
            </div>

            <GlassField label="Nomor anggota">
              <GlassInput value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} placeholder="1001" />
            </GlassField>
            <GlassField label="Nama">
              <GlassInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
            </GlassField>
            <GlassField label="Telepon">
              <GlassInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opsional" />
            </GlassField>
            <GlassField label="Alamat">
              <GlassInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Opsional" />
            </GlassField>
            <GlassField label="Status">
              <GlassDataSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            </GlassField>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="h-9 flex-1 rounded-md bg-foreground text-sm font-medium text-background transition disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : editingId ? "Simpan perubahan" : "Tambah anggota"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="h-9 rounded-md border border-border px-3 text-sm">
                  Batal
                </button>
              ) : null}
            </div>
          </GlassPanel>
        }
      />
    </div>
  );
}
