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
  return (
    <GlassPanel className="relative z-20 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="text-sm text-muted">Report</p><h1 className="text-2xl font-semibold">{title}</h1></div>
      <div className="flex flex-wrap items-center gap-2">
        {onStartsOnChange ? (
          <label className="flex items-center gap-1 text-xs text-muted">
            Dari
            <GlassDatePicker value={toDateInput(startsOn)} onChange={(v) => onStartsOnChange(new Date(v + "T00:00:00"))} className="h-9" />
          </label>
        ) : null}
        {onEndsOnChange ? (
          <label className="flex items-center gap-1 text-xs text-muted">
            S/d
            <GlassDatePicker value={toDateInput(endsOn)} onChange={(v) => onEndsOnChange(new Date(v + "T23:59:59"))} className="h-9" />
          </label>
        ) : null}
        <ExportDropdown onExportPdf={onExportPdf} onExportExcel={onExportExcel} />
      </div>
    </GlassPanel>
  );
}

export function ReportDrilldownSurface({ children }: { children: ReactNode }) {
  return <GlassPanel><h2 className="text-base font-semibold">Drilldown</h2><div className="mt-4">{children}</div></GlassPanel>;
}
