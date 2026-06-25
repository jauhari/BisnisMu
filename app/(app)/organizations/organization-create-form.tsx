"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";

const ORG_TYPE_OPTIONS = [
  { value: "BUMDES", label: "BUMDes" },
  { value: "KOPERASI", label: "Koperasi" },
  { value: "HOLDING", label: "Holding UMKM" },
  { value: "FRANCHISE", label: "Waralaba" },
];

export function OrganizationCreateForm() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("BUMDES");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (name.trim().length < 3) {
      toast.error("Nama organisasi minimal 3 karakter.");
      return;
    }
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
      setName("");
      setType("BUMDES");
      setShowCreate(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
    </>
  );
}
