"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/presentation/theme/cn";

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const MONTH_NAMES_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function monthMatrix(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const startDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type Mode = "day" | "month" | "year";

export function GlassCalendar({ value, onSelect }: { value?: Date; onSelect?: (date: Date) => void }) {
  const today = value ?? new Date();
  const [cursor, setCursor] = useState(() => ({ year: today.getUTCFullYear(), month: today.getUTCMonth() }));
  const [mode, setMode] = useState<Mode>("day");
  // year picker: tampilkan 12 tahun sekaligus, mulai dari yearPage * 12
  const [yearPage, setYearPage] = useState(() => Math.floor((today.getUTCFullYear()) / 12));
  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);

  // ── Header label ──────────────────────────────────────────────────────────
  const headerLabel = mode === "day"
    ? `${MONTH_NAMES_ID[cursor.month]} ${cursor.year}`
    : mode === "month"
    ? `${cursor.year}`
    : `${yearPage * 12} – ${yearPage * 12 + 11}`;

  function handleHeaderClick() {
    if (mode === "day") setMode("month");
    else if (mode === "month") setMode("year");
    else setMode("day");
  }

  function prevPage() {
    if (mode === "day") setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
    else if (mode === "month") setCursor((c) => ({ ...c, year: c.year - 1 }));
    else setYearPage((p) => p - 1);
  }
  function nextPage() {
    if (mode === "day") setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
    else if (mode === "month") setCursor((c) => ({ ...c, year: c.year + 1 }));
    else setYearPage((p) => p + 1);
  }

  const basePanel = "rounded-lg border border-border bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-950/90";
  const headerBtn = "text-sm font-semibold hover:text-accent transition-colors px-1 rounded";

  return (
    <div className={basePanel} style={{ minWidth: 280 }}>
      {/* ── Navigation header ── */}
      <div className="mb-3 flex items-center justify-between gap-1">
        <button type="button" onClick={prevPage} className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={handleHeaderClick} className={headerBtn}>
          {headerLabel}
        </button>
        <button type="button" onClick={nextPage} className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Day view ── */}
      {mode === "day" && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-1">
            {["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => (
              <button
                key={i}
                type="button"
                disabled={!cell}
                onClick={() => cell && onSelect?.(cell)}
                className={cn(
                  "h-9 rounded-md text-sm",
                  cell ? "hover:bg-black/5 dark:hover:bg-white/10" : "opacity-0 pointer-events-none",
                  value && cell && value.toISOString().slice(0,10) === cell.toISOString().slice(0,10)
                    ? "bg-foreground text-background font-medium"
                    : ""
                )}
              >
                {cell?.getUTCDate() ?? ""}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Month view ── */}
      {mode === "month" && (
        <div className="grid grid-cols-3 gap-2">
          {MONTHS_ID.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => { setCursor((c) => ({ ...c, month: i })); setMode("day"); }}
              className={cn(
                "rounded-md py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10",
                cursor.month === i ? "bg-foreground text-background font-medium" : ""
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* ── Year view ── */}
      {mode === "year" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => yearPage * 12 + i).map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => { setCursor((c) => ({ ...c, year: yr })); setMode("month"); }}
              className={cn(
                "rounded-md py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10",
                cursor.year === yr ? "bg-foreground text-background font-medium" : ""
              )}
            >
              {yr}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
