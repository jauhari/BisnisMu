"use client";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

export default function Page() {
  const floats = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  if (floats.isLoading) return <GlassSkeleton className="h-72" />;
  if (floats.error) return <GlassErrorState title="Float snapshots unavailable" description="Unable to load float balances." />;
  const rows = (floats.data?.data ?? []).map((f: any) => ({ provider: f.provider, name: f.name, balance: String(f.currentBalance ?? 0), status: f.isActive ? "Active" : "Inactive" }));
  const total = rows.reduce((s: number, r: any) => s + Number(r.balance), 0);
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Float" title="Float Snapshots" description="Current provider float balances. Snapshots reflect live balances maintained by FloatManagementService." /><section className="grid gap-4 md:grid-cols-2"><GlassStatsCard title="Total float balance" value={String(total)} detail="All providers" /><GlassStatsCard title="Accounts" value={String(rows.length)} detail="Configured" /></section><SplitWorkspace main={<GlassTable columns={[{ key: "provider", header: "Provider" }, { key: "name", header: "Name" }, { key: "balance", header: "Current balance" }, { key: "status", header: "Status" }]} rows={rows} empty="No float accounts loaded" />} side={<DetailPanel title="Balances">Balances update automatically after each top-up, consume, transfer, or adjustment.</DetailPanel>} /></div>;
}
