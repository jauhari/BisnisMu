import { GlassCard } from "../glass/glass-primitives";

export function GlassTableToolbar() {
  return <GlassCard className="flex flex-wrap items-center gap-2 p-3"><button className="h-9 rounded-md border border-border px-3 text-sm">Search</button><button className="h-9 rounded-md border border-border px-3 text-sm">Filters</button><button className="h-9 rounded-md border border-border px-3 text-sm">Columns</button><button className="h-9 rounded-md border border-border px-3 text-sm">Export Excel</button><button className="h-9 rounded-md border border-border px-3 text-sm">Export PDF</button><button className="h-9 rounded-md border border-border px-3 text-sm">Bulk actions</button></GlassCard>;
}
