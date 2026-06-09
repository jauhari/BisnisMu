"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function FormDrawer({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 ease-out ${shown ? "translate-x-0" : "translate-x-full"}`}>
        <header className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
