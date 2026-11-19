"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, KeyRound } from "lucide-react";
import { GlassInput, GlassPasswordInput } from "@/components/forms/glass-form";
import { toast } from "sonner";
import { apiRequest } from "@/presentation/api/client";

export function ProfileModal({ user, onClose }: { user: { name: string; email: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  async function save() {
    if (newPw && newPw !== confirmPw) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }
    if (newPw && newPw.length < 8) {
      toast.error("Password minimal 8 karakter.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          name: name !== user.name ? name : undefined,
          currentPassword: currentPw || undefined,
          newPassword: newPw || undefined,
        }),
      });
      toast.success("Profil diperbarui.");
      void qc.invalidateQueries({ queryKey: ["auth", "me"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Edit Profil" className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit Profil</h2>
          <button type="button" aria-label="Tutup" onClick={onClose} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs text-muted">Email (tidak bisa diubah)</p>
            <p className="rounded-lg border border-border bg-white/40 px-3 py-2 text-sm text-muted dark:bg-white/5">{user.email}</p>
          </div>
          <label className="grid gap-1">
            <span className="text-xs text-muted">Nama</span>
            <GlassInput value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </label>

          <div className="border-t border-border/60 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><KeyRound className="h-3.5 w-3.5" /> Ganti Password (opsional)</p>
            <div className="space-y-2">
              <GlassPasswordInput value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Password saat ini" className="h-9" autoComplete="current-password" />
              <GlassPasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Password baru (min 8 karakter)" className="h-9" autoComplete="new-password" />
              <GlassPasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Konfirmasi password baru" className="h-9" autoComplete="new-password" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm text-muted">Batal</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="h-9 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50">
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
