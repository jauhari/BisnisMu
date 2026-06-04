"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { GlassPanel } from "../glass/glass-primitives";
import { GlassDatePicker } from "@/components/forms/glass-form";

interface ReportRange {
  startsOn?: Date;
  endsOn?: Date;
  onStartsOnChange?: (d: Date) => void;
  onEndsOnChange?: (d: Date) => void;
}

// ─── Period Presets ──────────────────────────────────────────────────────────

type PresetKey = "week" | "month" | "3m" | "6m" | "year" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "week",   label: "Minggu Ini" },
  { key: "month",  label: "Bulan Ini"  },
  { key: "3m",     label: "3 Bulan"    },
  { key: "6m",     label: "6 Bulan"    },
  { key: "year",   label: "Tahun Ini"  },
  { key: "custom", label: "Custom"     },
];

function computePreset(key: PresetKey): { startsOn: Date; endsOn: Date } | null {
  if (key === "custom") return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  switch (key) {
    case "week": {
      const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon…6=Sun
      const mon = new Date(y, m, now.getDate() - dow);
      const sun = new Date(y, m, now.getDate() - dow + 6);
      return { startsOn: mon, endsOn: endOfDay(sun) };
    }
    case "month":
      return { startsOn: new Date(y, m, 1), endsOn: new Date(y, m + 1, 0, 23, 59, 59) };
    case "3m":
      return { startsOn: new Date(y, m - 2, 1), endsOn: endOfDay(now) };
    case "6m":
      return { startsOn: new Date(y, m - 5, 1), endsOn: endOfDay(now) };
    case "year":
      return { startsOn: new Date(y, 0, 1), endsOn: new Date(y, 11, 31, 23, 59, 59) };
  }
}

interface ExportActions {
  onExportPdf?: (() => void) | undefined;
  onExportExcel?: (() => void) | undefined;
}

function toDateInput(d: Date | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ExportDropdown({ onExportPdf, onExportExcel }: ExportActions) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  async function handle(format: "pdf" | "xlsx") {
    setOpen(false);
    setExporting(format);
    try {
      if (format === "pdf") await onExportPdf?.();
      else await onExportExcel?.();
    } finally {
      setExporting(null);
    }
  }

  if (!onExportPdf && !onExportExcel) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!!exporting}
        className="flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
      >
        <FileDown className="h-4 w-4" />
        {exporting ? (exporting === "pdf" ? "Membuat PDF…" : "Membuat Excel…") : "Export"}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-40 rounded-lg border border-border bg-white/90 py-1 shadow-lg backdrop-blur dark:bg-slate-950/90">
          {onExportPdf && (
            <button type="button" onClick={() => handle("pdf")} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/10">
              <span>📄</span> PDF
            </button>
          )}
          {onExportExcel && (
            <button type="button" onClick={() => handle("xlsx")} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/60 dark:hover:bg-white/10">
              <span>📊</span> Excel (.xlsx)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ReportWorkspace({ title, children, onExportPdf, onExportExcel, ...range }: { title: string; children: ReactNode } & ReportRange & ExportActions) {
  return <div className="grid gap-6"><ReportFilterBar title={title} onExportPdf={onExportPdf} onExportExcel={onExportExcel} {...range} />{children}</div>;
}

export function ReportFilterBar({ title, startsOn, endsOn, onStartsOnChange, onEndsOnChange, onExportPdf, onExportExcel }: { title: string } & ReportRange & ExportActions) {
  const [activePreset, setActivePreset] = useState<PresetKey>("month");

  function selectPreset(key: PresetKey) {
    setActivePreset(key);
    if (key === "custom") return;
    const range = computePreset(key);
    if (!range) return;
    onStartsOnChange?.(range.startsOn);
    onEndsOnChange?.(range.endsOn);
  }

  return (
    <GlassPanel className="relative z-20 grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-muted">Laporan</p><h1 className="text-2xl font-semibold">{title}</h1></div>
        <ExportDropdown onExportPdf={onExportPdf} onExportExcel={onExportExcel} />
      </div>

      {/* Preset period buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => selectPreset(p.key)}
            className={`h-8 rounded-lg px-3 text-sm transition ${
              activePreset === p.key
                ? "bg-accent text-white font-medium"
                : "border border-border text-muted hover:border-accent/60 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Custom date pickers — hanya tampil saat Custom dipilih */}
        {activePreset === "custom" && onStartsOnChange && onEndsOnChange && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-1">
            <span className="text-xs text-muted">Dari</span>
            <GlassDatePicker
              value={toDateInput(startsOn)}
              onChange={(v) => onStartsOnChange(new Date(v + "T00:00:00"))}
              className="h-8"
            />
            <span className="text-xs text-muted">s/d</span>
            <GlassDatePicker
              value={toDateInput(endsOn)}
              onChange={(v) => onEndsOnChange(new Date(v + "T23:59:59"))}
              className="h-8"
            />
          </div>
        )}
      </div>

      {/* Info periode aktif */}
      <p className="text-xs text-muted">
        Periode: <span className="font-medium text-foreground">
          {toDateInput(startsOn)} → {toDateInput(endsOn)}
        </span>
      </p>
    </GlassPanel>
  );
}

export function ReportDrilldownSurface({ children }: { children: ReactNode }) {
  return <GlassPanel><h2 className="text-base font-semibold">Drilldown</h2><div className="mt-4">{children}</div></GlassPanel>;
}
