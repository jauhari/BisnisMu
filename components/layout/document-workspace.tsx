import type { ReactNode } from "react";
import { GlassPanel } from "../glass/glass-primitives";

export function DocumentWorkspace({ children, summary }: { children: ReactNode; summary: ReactNode }) { return <div className="grid gap-6 xl:grid-cols-[1fr_360px]"><main className="grid gap-6">{children}</main><aside className="grid content-start gap-6">{summary}</aside></div>; }
export function DocumentSummary({ title, lines }: { title: string; lines: Array<{ label: string; value: ReactNode }> }) { return <GlassPanel><h2 className="text-base font-semibold">{title}</h2><div className="mt-4 grid gap-3">{lines.map((line) => <div key={line.label} className="flex items-center justify-between gap-4 text-sm"><span className="text-muted">{line.label}</span><span className="font-medium tabular-nums">{line.value}</span></div>)}</div></GlassPanel>; }
