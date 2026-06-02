"use client";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
export default function Page() { const { data, isLoading, error } = useListQuery<any[]>("/api/pos/receipts", ["list", "pos-receipts"]); if (isLoading) return <GlassSkeleton className="h-72" />; if (error || !data) return <GlassErrorState title="Receipts unavailable" description="Unable to load receipts." />; return <div className="grid gap-6"><WorkspaceHeader eyebrow="POS" title="Receipts" description="Receipt lookup and source tracing for completed POS transactions." action={<button className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background">Search receipt</button>} /><GlassTable columns={[{ key: "receipt", header: "Receipt" }, { key: "transaction", header: "Transaction" }, { key: "issued", header: "Issued" }, { key: "paid", header: "Paid" }, { key: "change", header: "Change" }]} rows={data.data} empty="No receipts loaded" /></div>; }
