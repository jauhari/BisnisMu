"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton, GlassErrorState } from "@/components/feedback/glass-feedback";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";
import { apiRequest } from "@/presentation/api/client";

interface OrgSummary {
  id: string;
  name: string;
  type: string;
  role: string;
  unitCount: number;
}

const ORG_TYPE_OPTIONS = [
  { value: "BUMDES", label: "BUMDes" },
  { value: "KOPERASI", label: "Koperasi" },
  { value: "HOLDING", label: "Holding UMKM" },
  { value: "FRANCHISE", label: "Waralaba" },
];

export default function Page() {
  const qc = useQueryClient();
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiRequest<{ data: OrgSummary[] }>("/api/organizations"),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("BUMDES");
  const [busy, setBusy] = useState(false);

  if (orgs.isLoading) return <GlassSkeleton className="h-72" />;
  if (orgs.error) return <GlassErrorState title="Gagal memuat" description="Tidak dapat memuat daftar organisasi." />;

  const list: OrgSummary[] = (orgs.data as any)?.data ?? [];

  async function handleCreate() {
    if (name.trim().length < 3) { toast.error("Nama organisasi minimal 3 karakter."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || json?.message || "Gagal membuat organisasi.");
      toast.success("Organisasi dibuat.");
      setName(""); setType("BUMDES"); setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ["organizations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Multi-Unit"
        title="Organisasi"
        description="Lembaga induk (BUMDes, koperasi, holding) yang menaungi beberapa unit usaha untuk laporan konsolidasi."
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="h-9 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted/20"
        >
          {showCreate ? "Batal" : "+ Organisasi Baru"}
        </button>
      </div>

      {showCreate && (
        <GlassPanel className="grid gap-4">
          <h2 className="text-sm font-semibold">Buat Organisasi</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Nama Organisasi
              <GlassInput value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. BUMDes Hanyukupi" className="h-9" />
            </label>
            <label className="grid gap-1 text-xs">Tipe
              <GlassDataSelect value={type} onChange={setType} options={ORG_TYPE_OPTIONS} className="h-9" />
            </label>
          </div>
          <button type="button" onClick={handleCreate} disabled={busy} className="h-10 w-fit rounded-md bg-foreground px-6 text-sm font-medium text-background disabled:opacity-40">
            {busy ? "Membuat…" : "Buat"}
          </button>
        </GlassPanel>
      )}

      {list.length === 0 ? (
        <GlassPanel><p className="text-sm text-muted">Belum ada organisasi. Buat satu untuk menggabungkan beberapa unit usaha.</p></GlassPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o) => (
            <Link key={o.id} href={`/organizations/${o.id}`}>
              <GlassPanel className="h-full cursor-pointer transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-semibold">{o.name}</p>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{o.role.replace("ORG_", "")}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{o.type}</p>
                <p className="mt-3 text-sm">{o.unitCount} unit usaha</p>
              </GlassPanel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
