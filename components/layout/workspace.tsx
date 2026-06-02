import type { ReactNode } from "react";
import { GlassPanel } from "../glass/glass-primitives";

export function WorkspaceHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-medium text-accent">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p></div>{action}</section>;
}

export function SplitWorkspace({ main, side }: { main: ReactNode; side: ReactNode }) { return <div className="grid gap-6 xl:grid-cols-[1fr_380px]"><div className="grid gap-6">{main}</div><aside className="grid content-start gap-6">{side}</aside></div>; }
export function DetailPanel({ title, children }: { title: string; children: ReactNode }) { return <GlassPanel><h2 className="text-base font-semibold">{title}</h2><div className="mt-4 text-sm text-muted">{children}</div></GlassPanel>; }
