import type { ReactNode } from "react";
import { GlassKpiCard, GlassPanel } from "../glass/glass-primitives";

export function DashboardGrid({ children }: { children: ReactNode }) { return <div className="grid gap-6">{children}</div>; }
export function KpiGrid({ items }: { items: Array<{ title: string; value: ReactNode; detail?: ReactNode }> }) { return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <GlassKpiCard key={item.title} title={item.title} value={item.value} detail={item.detail} />)}</section>; }
export function RealtimeStatus({ label = "Data terbaru" }: { label?: string }) { return <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success"><span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />{label}</span>; }
export function DashboardExceptionPanel({ children, title = "Perlu perhatian" }: { children: ReactNode; title?: string }) { return <GlassPanel><h2 className="text-base font-semibold">{title}</h2><div className="mt-4">{children}</div></GlassPanel>; }
