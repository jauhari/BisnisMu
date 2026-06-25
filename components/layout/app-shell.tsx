"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCommandPalette } from "../glass/glass-primitives";
import { SidebarNav } from "./sidebar-nav";
import Link from "next/link";
import { Menu, X, PanelLeftClose, PanelLeftOpen, LogOut, ChevronDown, UserCircle, KeyRound, Pencil, Plus } from "lucide-react";
import { useActiveBusiness, useCurrentUser } from "@/presentation/query/report-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { GlassInput, GlassPasswordInput } from "@/components/forms/glass-form";
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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Dialog a11y: trap nothing heavy, but restore focus, close on Escape, and
  // move focus into the dialog on open.
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
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

// ─── Business Switcher (dropdown di header) ─────────────────────────────────────
interface SwitchableBusiness { id: string; name: string; role: string; active: boolean; }

function BusinessSwitcher({ activeName }: { activeName: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SwitchableBusiness[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/businesses", { credentials: "include" });
      const json = await r.json();
      setItems(Array.isArray(json) ? json : (json.data ?? []));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) void load();
  }

  async function select(id: string, isActive: boolean) {
    if (isActive) { setOpen(false); return; }
    setSwitching(id);
    try {
      const res = await fetch("/api/auth/select-business", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || j?.message || "Gagal mengganti usaha.");
      }
      toast.success("Usaha aktif diganti.");
      setOpen(false);
      await qc.invalidateQueries();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengganti usaha.");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        title="Ganti usaha"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition hover:bg-white/60 dark:hover:bg-white/10"
      >
        <div className="text-left">
          <p className="text-xs text-muted">Usaha aktif</p>
          <p className="text-sm font-medium">{activeName}</p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl border border-border bg-background p-1.5 shadow-xl">
          <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted">Pilih Usaha</p>
          <div className="max-h-72 overflow-y-auto">
            {loading && <p className="px-3 py-3 text-sm text-muted">Memuat…</p>}
            {!loading && items && items.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted">Belum tergabung di usaha manapun.</p>
            )}
            {!loading && items?.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={switching !== null}
                onClick={() => void select(b.id, b.active)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition disabled:opacity-50 ${
                  b.active ? "bg-accent/8" : "hover:bg-white/60 dark:hover:bg-white/8"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-[11px] text-muted">{b.role}</p>
                </div>
                {switching === b.id ? (
                  <span className="shrink-0 text-[11px] text-muted">Memuat…</span>
                ) : b.active ? (
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Aktif</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-1 border-t border-border/60 pt-1">
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent hover:bg-white/60 dark:hover:bg-white/8"
            >
              <Plus className="h-4 w-4" /> Buat usaha baru
            </Link>
          </div>
        </div>
      )}
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

  const isGodMode = ["SUPER_ADMIN", "SUPPORT_AGENT", "DEVELOPER"].includes((currentUser?.platformRole ?? "USER") as any);

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
      <div className={`flex h-16 items-center gap-3 border-b border-border/60 ${collapsed ? "lg:justify-center lg:px-0 px-5" : "px-5"}`}>
        <img
          src="/logo.png"
          alt="Logo BisnisMu"
          className="h-9 w-9 shrink-0 object-contain"
        />
        <div className={`leading-tight ${collapsed ? "lg:hidden" : ""}`}>
          <p className="text-base font-semibold">BisnisMu</p>
          <p className="text-[11px] text-muted">Akuntansi UMKM</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <SidebarNav collapsed={collapsed} onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Tautan Changelog yang tidak terlalu mencolok (khusus God Mode) */}
      {isGodMode && (
        <div className={`p-2 border-t border-border/40 text-center ${collapsed ? "px-1" : "px-4"}`}>
          <Link
            href="/admin/changelog"
            className={`block rounded-lg py-1.5 text-[11px] text-muted/50 hover:text-muted hover:bg-white/50 dark:hover:bg-white/5 transition duration-150 truncate`}
            title="Lihat riwayat perubahan"
          >
            {collapsed ? "v0.5.0" : "Changelog v0.5.0"}
          </Link>
        </div>
      )}

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
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/70 px-4 backdrop-blur-glass xl:px-6 2xl:px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden" aria-label="Toggle sidebar">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <BusinessSwitcher activeName={activeBusiness?.name ?? "—"} />
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
      <main className="mx-auto max-w-[1680px] p-3 sm:p-4 xl:p-6 2xl:p-8">{children}</main>
    </div>

    {editProfile && currentUser && (
      <ProfileModal user={currentUser} onClose={() => setEditProfile(false)} />
    )}
  </div>;
}
