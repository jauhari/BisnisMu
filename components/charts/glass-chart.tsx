import type { ReactNode } from "react";
import { GlassChartCard } from "../glass/glass-primitives";

export function GlassTrendChart({ title, children }: { title: string; children?: ReactNode }) {
  return <GlassChartCard title={title}>{children ?? <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">Chart data unavailable for the selected range.</div>}</GlassChartCard>;
}
