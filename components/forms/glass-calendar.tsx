"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/presentation/theme/cn";

function monthMatrix(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const startDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(Date.UTC(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function GlassCalendar({ value, onSelect }: { value?: Date; onSelect?: (date: Date) => void }) {
  const today = value ?? new Date();
  const [cursor, setCursor] = useState(() => ({ year: today.getUTCFullYear(), month: today.getUTCMonth() }));
  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  return <div className="rounded-lg border border-border bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-950/90">
    <div className="mb-3 flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })}><ChevronLeft className="h-4 w-4" /></button><div className="text-sm font-medium">{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}</div><button type="button" aria-label="Next month" onClick={() => setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })}><ChevronRight className="h-4 w-4" /></button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">{["Min", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => <div key={d}>{d}</div>)}</div>
    <div className="mt-2 grid grid-cols-7 gap-1">{cells.map((cell, index) => <button key={index} type="button" disabled={!cell} onClick={() => cell && onSelect?.(cell)} className={cn("h-9 rounded-md text-sm", cell ? "hover:bg-white/60 dark:hover:bg-white/10" : "opacity-0", value && cell && value.toISOString().slice(0, 10) === cell.toISOString().slice(0, 10) ? "bg-foreground text-background" : "")}>{cell?.getUTCDate() ?? ""}</button>)}</div>
  </div>;
}
