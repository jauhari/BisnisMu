import type { ReactNode } from "react";
import { GlassPanel } from "../glass/glass-primitives";

export function WorkspaceHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <section className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="text-sm font-medium text-accent">{eyebrow}</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p></div>{action ? <div className="min-w-0 lg:shrink-0">{action}</div> : null}</section>;
}

export function SplitWorkspace({ main, side }: { main: ReactNode; side: ReactNode }) { return <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]"><div className="grid min-w-0 gap-5">{main}</div><aside className="grid min-w-0 content-start gap-4 md:grid-cols-3 2xl:grid-cols-1">{side}</aside></div>; }
export function DetailPanel({ title, children }: { title: string; children: ReactNode }) { return <GlassPanel className="min-w-0"><h2 className="text-base font-semibold">{title}</h2><div className="mt-4 break-words text-sm leading-6 text-muted">{children}</div></GlassPanel>; }
