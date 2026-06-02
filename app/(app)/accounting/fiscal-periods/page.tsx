"use client";
import { z } from "zod";
import { ManagedForm, RhfTextField } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ fiscalYear: z.string().regex(/^\d{4}$/, "Tahun 4 digit") });
type FiscalPeriodForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/accounting/fiscal-periods");
  const { data, isLoading, error } = useListQuery<any[]>("/api/accounting/fiscal-periods", ["list", "accounting-periods"]);
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Fiscal periods unavailable" description="Unable to load fiscal periods." />;
  const rows = (data.data ?? []).map((p: any) => ({ year: p.fiscalYear, start: p.startsOn?.slice?.(0, 10) ?? p.startsOn, end: p.endsOn?.slice?.(0, 10) ?? p.endsOn, status: p.status, closedBy: p.closedByUserId ?? "-" }));
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Accounting" title="Fiscal Periods" description="Open, close, and reopen fiscal periods through BusinessService." /><SplitWorkspace main={<><ManagedForm<FiscalPeriodForm> schema={schema} defaultValues={{ fiscalYear: "2026" }} onSubmit={async (values) => { await mutation.mutateAsync({ fiscalYear: Number(values.fiscalYear) }); }}>{() => <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2"><RhfTextField<FiscalPeriodForm> name="fiscalYear" label="Fiscal year" placeholder="2026" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Open period</button></div>}</ManagedForm><GlassTable columns={[{ key: "year", header: "Fiscal year" }, { key: "start", header: "Starts" }, { key: "end", header: "Ends" }, { key: "status", header: "Status" }, { key: "closedBy", header: "Closed by" }]} rows={rows} empty="No fiscal periods loaded" /></>} side={<><DetailPanel title="Open period">Period dates are derived from the business fiscal year start month.</DetailPanel><DetailPanel title="Reopen period">Reopen requires an audit reason and stays traceable.</DetailPanel></>} /></div>;
}
