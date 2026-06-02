"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassChartCard } from "../glass/glass-primitives";

export interface TrendPoint { label: string; value: number; secondary?: number; }

export function RevenueTrendChart({ data, title = "Revenue trend" }: { data: TrendPoint[]; title?: string }) {
  return <GlassChartCard title={title}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.35}/><stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}/><Area type="monotone" dataKey="value" stroke="hsl(var(--accent))" fill="url(#revenueGradient)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></GlassChartCard>;
}

export function ActivityBarChart({ data, title = "Activity" }: { data: TrendPoint[]; title?: string }) {
  return <GlassChartCard title={title}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}/><Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--success))" /></BarChart></ResponsiveContainer></div></GlassChartCard>;
}
