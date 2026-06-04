"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCommandPalette } from "../glass/glass-primitives";
import { SidebarNav } from "./sidebar-nav";
import Link from "next/link";
import { Menu, X, PanelLeftClose, PanelLeftOpen, LogOut, ChevronDown, UserCircle, KeyRound, Pencil } from "lucide-react";
import { useActiveBusiness, useCurrentUser } from "@/presentation/query/report-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { GlassInput } from "@/components/forms/glass-form";
import { toast } from "sonner";
import { apiRequest } from "@/presentation/api/client";

const COLLAPSE_KEY = "bisnismu:sidebar-collapsed";

// ─── Modal Edit Profil ────────────────────────────────────────────────────────
function ProfileModal({ user, onClose }: { user: { name: string; email: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName]               = useState(user.name);
  const [currentPw, setCurrentPw]     = useState("");
  const [newPw, setNewPw]             = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [saving, setSaving]           = useState(false);

  async function save() {
    if (newPw && newPw !== confirmPw) { toast.error("Konfirmasi password tidak cocok."); return; }
    if (newPw && newPw.length < 8)   { toast.error("Password minimal 8 karakter."); return; }
    setSaving(true);
    try {
      await apiRequest("/api/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          name: name !== user.name ? name : undefined,
          currentPassword: currentPw || undefined,
          newPassword:     newPw     || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit Profil</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
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
              <GlassInput type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Password saat ini" className="h-9" />
              <GlassInput type="password" value={newPw}     onChange={(e) => setNewPw(e.target.value)}     placeholder="Password baru (min 8 karakter)" className="h-9" />
              <GlassInput type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Konfirmasi password baru" className="h-9" />
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

// ─── AppShell ─────────────────────────────────────────────────────────────────
export function AppShell({ children }: { children: ReactNode }) {
  const { data: activeBusiness } = useActiveBusiness();
  const { data: currentUser }    = useCurrentUser();
  const router = useRouter();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [collapsed,    setCollapsed]    = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [editProfile,  setEditProfile]  = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  // Inisial dari nama untuk avatar
  const initials = currentUser?.name
    ? currentUser.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // Muat preferensi collapse dari sesi sebelumnya.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  const toggleCollapsed = () => setCollapsed((prev) => {
    const next = !prev;
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });

  const railWidth = collapsed ? "lg:w-[76px]" : "lg:w-72";
  const mainPad = collapsed ? "lg:pl-[76px]" : "lg:pl-72";

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.10),transparent_32rem),hsl(var(--background))]">
    {/* Mobile overlay */}
    {sidebarOpen && (
      <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
    )}

    {/* Sidebar (mobile selalu lebar penuh; desktop bisa di-collapse jadi rail ikon) */}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/70 bg-white/60 backdrop-blur-glass transition-[transform,width] duration-200 dark:bg-white/6 lg:z-0 lg:translate-x-0 ${railWidth} ${
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    } lg:translate-x-0`}>
      <div className={`flex items-center gap-3 border-b border-border/60 py-4 ${collapsed ? "lg:justify-center lg:px-0 px-5" : "px-5"}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-background shadow-sm">
          <span className="text-base font-bold">A</span>
        </span>
        <div className={`leading-tight ${collapsed ? "lg:hidden" : ""}`}>
          <p className="text-base font-semibold">BisnisMu</p>
          <p className="text-[11px] text-muted">Akuntansi UMKM</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <SidebarNav collapsed={collapsed} onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Tombol Collapse/Expand (hanya desktop) */}
      <div className="hidden border-t border-border/60 p-2 lg:block">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Perlebar sidebar" : "Perkecil sidebar"}
          title={collapsed ? "Perlebar sidebar" : "Perkecil sidebar"}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10 ${collapsed ? "justify-center" : ""}`}
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <><PanelLeftClose className="h-[18px] w-[18px]" /><span>Perkecil</span></>}
        </button>
      </div>
    </aside>

    <div className={mainPad}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/70 px-4 backdrop-blur-glass lg:px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden" aria-label="Toggle sidebar">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link href="/select-business" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-white/60 dark:hover:bg-white/10" title="Ganti usaha">
            <div><p className="text-xs text-muted">Usaha aktif</p><p className="text-sm font-medium">{activeBusiness?.name ?? "—"}</p></div>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block"><GlassCommandPalette className="w-80 px-4 py-2 text-sm text-muted">Command palette / search</GlassCommandPalette></div>

          {/* User chip + dropdown */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/60 dark:hover:bg-white/10"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-background">
                {initials}
              </span>
              <span className="hidden flex-col items-start md:flex">
                <span className="text-sm font-medium leading-tight">{currentUser?.name ?? "—"}</span>
                <span className="text-[11px] text-muted leading-tight">{currentUser?.email ?? ""}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-background p-1.5 shadow-xl">
                <div className="px-3 py-2 border-b border-border/60 mb-1">
                  <p className="text-sm font-medium truncate">{currentUser?.name}</p>
                  <p className="text-xs text-muted truncate">{currentUser?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditProfile(true); setUserMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/8"
                >
                  <Pencil className="h-4 w-4 text-muted" /> Edit Profil
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/8"
                >
                  <LogOut className="h-4 w-4" /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 lg:p-8">{children}</main>
    </div>

    {editProfile && currentUser && (
      <ProfileModal user={currentUser} onClose={() => setEditProfile(false)} />
    )}
  </div>;
}
