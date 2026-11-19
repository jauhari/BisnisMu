"use client";

import { useEffect, type ReactElement } from "react";
import { GlassDialog, GlassDialogActionBar } from "@/components/glass/glass-primitives";

export type ConfirmActionState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

// Shared by cash & transactions pages so destructive actions (hapus / batalkan) never fire on a single click.
export function ConfirmActionDialog({ state, onClose }: { state: ConfirmActionState; onClose: () => void }): ReactElement | null {
  useEffect(() => {
    if (!state) return;
    const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
        <GlassDialog aria-label={state.title} className="bg-background">
          <h2 className="text-base font-semibold">{state.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
          <GlassDialogActionBar>
            <button type="button" autoFocus onClick={onClose} className="h-9 rounded-md border border-border px-4 text-sm">Kembali</button>
            <button type="button" onClick={() => { state.onConfirm(); onClose(); }} className="h-9 rounded-md bg-danger px-4 text-sm font-medium text-white">{state.confirmLabel}</button>
          </GlassDialogActionBar>
        </GlassDialog>
      </div>
    </div>
  );
}
