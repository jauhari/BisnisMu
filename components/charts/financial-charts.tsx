"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassChartCard } from "../glass/glass-primitives";
import { formatNumber } from "@/presentation/format/number";

export interface TrendPoint { label: string; value: number; secondary?: number; }

// Tick sumbu ringkas: 1.000.000 → "1jt", 25.000 → "25rb".
const compact = (v: number): string => {
  const n = Math.abs(v);
  if (n >= 1_000_000_000) return (v / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "M";
  if (n >= 1_000_000) return (v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "jt";
  if (n >= 1_000) return (v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "rb";
  return formatNumber(v);
};

export function RevenueTrendChart({ data, title = "Revenue trend" }: { data: TrendPoint[]; title?: string }) {
  return <GlassChartCard title={title}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.35}/><stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => compact(Number(v))}/><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} formatter={(v) => formatNumber(Number(v))}/><Area type="monotone" dataKey="value" stroke="hsl(var(--accent))" fill="url(#revenueGradient)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></GlassChartCard>;
}

export function ActivityBarChart({ data, title = "Activity" }: { data: TrendPoint[]; title?: string }) {
  return <GlassChartCard title={title}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => compact(Number(v))}/><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} formatter={(v) => formatNumber(Number(v))}/><Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--success))" /></BarChart></ResponsiveContainer></div></GlassChartCard>;
}
