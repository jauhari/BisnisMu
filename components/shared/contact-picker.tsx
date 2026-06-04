"use client";

/**
 * ContactPicker — pilih kontak dari daftar atau buat baru.
 * Menampilkan nama kontak yang terpilih + tombol × untuk hapus.
 * Dipakai di scan page (tiket/paket) dan sales order.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Building2, UserPlus, X } from "lucide-react";
import { GlassInput } from "@/components/forms/glass-form";
import { apiRequest } from "@/presentation/api/client";
import { toast } from "sonner";

interface Contact { id: string; name: string; category: string; picName?: string; phone?: string; totalVisits?: number; }

interface Props {
  /** ID kontak yang sudah dipilih */
  value?: string | undefined;
  /** Label nama kontak yang sudah dipilih (untuk display) */
  valueName?: string | undefined;
  onChange: (contactId: string, contactName: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export function ContactPicker({ value, valueName, onChange, onClear, placeholder = "Cari / pilih kontak…", className }: Props) {
  const [q, setQ]             = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newCat,   setNewCat]   = useState<"INDIVIDUAL" | "INSTANSI">("INDIVIDUAL");
  const [newPic,   setNewPic]   = useState("");
  const [newPhone, setNewPhone] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const qc  = useQueryClient();

  // Tutup saat klik di luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDrop(false); setShowNew(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useQuery({
    queryKey: ["contacts-search", q],
    queryFn: () => apiRequest<{ data: Contact[] }>(`/api/contacts?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 1,
    staleTime: 10_000,
  });
  const contacts: Contact[] = search.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest<{ data: Contact }>("/api/contacts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["contacts-search"] }),
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const res = await createMutation.mutateAsync({
        name: newName.trim(), category: newCat,
        picName: newCat === "INSTANSI" ? newPic.trim() || undefined : undefined,
        phone: newPhone.trim() || undefined,
      });
      onChange(res.data.id, res.data.name);
      setShowNew(false); setNewName(""); setNewPic(""); setNewPhone(""); setQ("");
    } catch { toast.error("Gagal membuat kontak."); }
  }

  // Jika sudah ada kontak terpilih — tampilkan tag + tombol hapus
  if (value && valueName) {
    return (
      <div className={`flex h-8 items-center gap-2 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8 ${className ?? ""}`}>
        <User className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="flex-1 truncate text-sm">{valueName}</span>
        <button type="button" onClick={onClear} className="text-muted hover:text-danger">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <div className="flex gap-1.5">
        <GlassInput
          value={q}
          onChange={(e) => { setQ(e.target.value); setShowDrop(true); setShowNew(false); }}
          onFocus={() => { if (q.length >= 1) setShowDrop(true); }}
          placeholder={placeholder}
          className="h-8 flex-1 text-xs"
        />
        <button
          type="button"
          onClick={() => { setShowNew(true); setShowDrop(false); setQ(""); }}
          className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted hover:text-foreground"
          title="Tambah kontak baru"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Dropdown hasil pencarian */}
      {!showNew && showDrop && contacts.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-white/95 shadow-xl backdrop-blur dark:bg-slate-950/95">
          {contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id, c.name); setQ(""); setShowDrop(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/60 dark:hover:bg-white/8"
            >
              {c.category === "INSTANSI"
                ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted" />
                : <User className="h-3.5 w-3.5 shrink-0 text-muted" />}
              <span className="flex-1 truncate">{c.name}{c.picName ? ` (PJ: ${c.picName})` : ""}</span>
              {c.totalVisits ? <span className="text-xs text-muted">{c.totalVisits}× kunjungan</span> : null}
            </button>
          ))}
        </div>
      )}

      {/* Form tambah kontak baru */}
      {showNew && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-border bg-white/95 p-3 shadow-xl backdrop-blur dark:bg-slate-950/95 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Kontak Baru</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setNewCat("INDIVIDUAL")}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs ${newCat === "INDIVIDUAL" ? "bg-accent text-white" : "border border-border text-muted"}`}>
              <User className="h-3 w-3" /> Individu
            </button>
            <button type="button" onClick={() => setNewCat("INSTANSI")}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs ${newCat === "INSTANSI" ? "bg-accent text-white" : "border border-border text-muted"}`}>
              <Building2 className="h-3 w-3" /> Instansi
            </button>
          </div>
          <GlassInput value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder={newCat === "INSTANSI" ? "Nama instansi" : "Nama lengkap"} className="h-8 text-xs" />
          {newCat === "INSTANSI" && (
            <GlassInput value={newPic} onChange={(e) => setNewPic(e.target.value)}
              placeholder="Penanggung jawab (PJ)" className="h-8 text-xs" />
          )}
          <GlassInput value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
            placeholder="No. HP (opsional)" className="h-8 text-xs" />
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleCreate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="h-7 rounded-md bg-foreground px-3 text-xs text-background disabled:opacity-40">
              {createMutation.isPending ? "Menyimpan…" : "Simpan & Pilih"}
            </button>
            <button type="button" onClick={() => setShowNew(false)}
              className="h-7 rounded-md border border-border px-3 text-xs text-muted">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}
