"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import { cn } from "@/presentation/theme/cn";

/**
 * Checkbox bergaya glass dengan kontrol aksesibel.
 *
 * Input asli disembunyikan secara visual (opacity-0) tetapi tetap menjadi
 * pemilik state, fokus, dan perilaku keyboard/AT. Kotak berwarna hanya
 * lapisan visual — jadi tidak ada elemen form native yang tampil ke pengguna.
 *
 * Dipakai bersama oleh GlassTable dan halaman laporan supaya tidak ada
 * duplikasi implementasi.
 */
export function GlassCheckbox({
  checked,
  onChange,
  "aria-label": ariaLabel,
  indeterminate,
  className,
}: {
  checked: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  "aria-label"?: string;
  indeterminate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <label className={cn("relative inline-flex h-4 w-4 cursor-pointer items-center justify-center", className)}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        onChange={onChange}
        className="peer absolute inset-0 m-0 h-4 w-4 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex h-4 w-4 items-center justify-center rounded border border-border transition-colors",
          checked || indeterminate ? "border-accent bg-accent text-white" : "bg-white/60 dark:bg-white/10",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60",
        )}
      >
        {indeterminate ? <span className="h-0.5 w-2 rounded bg-current" /> : checked ? <Check className="h-3 w-3" /> : null}
      </span>
    </label>
  );
}
