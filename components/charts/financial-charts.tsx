"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { GlassChartCard } from "../glass/glass-primitives";
import { formatMoney, formatNumber } from "@/presentation/format/number";

export interface TrendPoint { label: string; value: number; secondary?: number; }

interface ChartProps {
  data: TrendPoint[];
  title?: string;
  /** "money" → tooltip "Rp 1.500.000"; "number" (default) → "1.500.000". */
  valueFormat?: "money" | "number";
  /** Nama seri di tooltip, mis. "Penjualan". */
  seriesLabel?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
}

// Tick sumbu ringkas: 1.000.000 → "1jt", 25.000 → "25rb".
const compact = (v: number): string => {
  const n = Math.abs(v);
  if (n >= 1_000_000_000) return (v / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "M";
  if (n >= 1_000_000) return (v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "jt";
  if (n >= 1_000) return (v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "rb";
  return formatNumber(v);
};

// Semua nol = tidak ada aktivitas. Grafik datar di sumbu 0–4 menyesatkan
// pengguna awam (terlihat seperti "rusak"), jadi tampilkan penjelasan saja.
function isEmptySeries(data: TrendPoint[]): boolean {
  return data.length === 0 || data.every((p) => !p.value && !p.secondary);
}

function ChartEmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/80 px-6 text-center">
      <BarChart3 className="h-8 w-8 text-muted" aria-hidden="true" />
      <p className="max-w-xs text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

function tooltipFormatter(valueFormat: "money" | "number", seriesLabel: string) {
  return (v: unknown): [string, string] => [
    valueFormat === "money" ? formatMoney(Number(v)) : formatNumber(Number(v)),
    seriesLabel,
  ];
}

const DEFAULT_EMPTY = "Belum ada data pada periode ini.";

export function RevenueTrendChart({ data, title = "Tren pendapatan", valueFormat = "number", seriesLabel = "Nilai", emptyMessage = DEFAULT_EMPTY, emptyAction }: ChartProps) {
  return (
    <GlassChartCard title={title}>
      {isEmptySeries(data) ? (
        <ChartEmptyState message={emptyMessage} action={emptyAction} />
      ) : (
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.35}/><stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => compact(Number(v))}/><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} formatter={tooltipFormatter(valueFormat, seriesLabel)}/><Area type="monotone" dataKey="value" stroke="hsl(var(--accent))" fill="url(#revenueGradient)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
      )}
    </GlassChartCard>
  );
}

export function ActivityBarChart({ data, title = "Aktivitas", valueFormat = "number", seriesLabel = "Nilai", emptyMessage = DEFAULT_EMPTY, emptyAction }: ChartProps) {
  return (
    <GlassChartCard title={title}>
      {isEmptySeries(data) ? (
        <ChartEmptyState message={emptyMessage} action={emptyAction} />
      ) : (
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => compact(Number(v))}/><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} formatter={tooltipFormatter(valueFormat, seriesLabel)}/><Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--success))" /></BarChart></ResponsiveContainer></div>
      )}
    </GlassChartCard>
  );
}
