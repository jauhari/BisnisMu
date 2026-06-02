import type { ReactNode } from "react";
import { GlassPanel } from "../glass/glass-primitives";
import { GlassDateRangePicker, GlassSelect } from "../forms/glass-form";

export function ReportWorkspace({ title, children }: { title: string; children: ReactNode }) { return <div className="grid gap-6"><ReportFilterBar title={title} />{children}</div>; }
export function ReportFilterBar({ title }: { title: string }) { return <GlassPanel className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm text-muted">Report</p><h1 className="text-2xl font-semibold">{title}</h1></div><div className="flex flex-wrap gap-2"><GlassDateRangePicker>Current period</GlassDateRangePicker><GlassSelect>Fiscal period</GlassSelect><button className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background">Export</button></div></GlassPanel>; }
export function ReportDrilldownSurface({ children }: { children: ReactNode }) { return <GlassPanel><h2 className="text-base font-semibold">Drilldown</h2><div className="mt-4">{children}</div></GlassPanel>; }
