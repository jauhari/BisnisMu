"use client";
import { z } from "zod";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard, GlassPanel } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { ManagedForm, RhfTextField } from "@/components/forms/rhf-form";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({
  provider: z.enum(["BUKUWARUNG", "FASTPAY", "PAYFAZZ", "SHOPEEPAY", "LINKAJA", "CUSTOM"]),
  name: z.string().min(2),
  floatAssetAccountId: z.string().min(10, { message: "Account id akun aset float wajib diisi" }),
  offsetAccountId: z.string().min(10, { message: "Account id akun offset wajib diisi" }),
});
type FloatForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/float/accounts");
  const { data, isLoading, error } = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Float accounts unavailable" description="Unable to load float accounts." />;
  const rows = data.data;
  const totalBalance = rows.reduce((sum: number, row: any) => sum + Number(row.currentBalance ?? row.balance ?? 0), 0);
  const providers = new Set(rows.map((row: any) => row.provider)).size;
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Float" title="Float Accounts" description="Provider float balances, offset accounts, and low-balance monitoring through FloatManagementService." /><section className="grid gap-4 md:grid-cols-3"><GlassStatsCard title="Total balance" value={String(totalBalance)} detail="All providers" /><GlassStatsCard title="Providers" value={String(providers)} detail="Active providers" /><GlassStatsCard title="Accounts" value={String(rows.length)} detail="Configured" /></section><SplitWorkspace main={<GlassTable columns={[{ key: "provider", header: "Provider" }, { key: "name", header: "Name" }, { key: "currentBalance", header: "Balance" }, { key: "floatAssetAccountId", header: "Asset account" }, { key: "status", header: "Status" }]} rows={rows} empty="No float accounts loaded" />} side={<><GlassPanel><ManagedForm<FloatForm> schema={schema} defaultValues={{ provider: "CUSTOM", name: "", floatAssetAccountId: "", offsetAccountId: "" }} onSubmit={async (values) => { await mutation.mutateAsync(values); }}>{() => <div className="grid gap-4"><RhfTextField<FloatForm> name="provider" label="Provider" placeholder="BUKUWARUNG / FASTPAY / CUSTOM" /><RhfTextField<FloatForm> name="name" label="Account name" placeholder="Float Bukuwarung" /><RhfTextField<FloatForm> name="floatAssetAccountId" label="Float asset account id" placeholder="UUID akun aset" /><RhfTextField<FloatForm> name="offsetAccountId" label="Offset account id" placeholder="UUID akun offset" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Save float account</button></div>}</ManagedForm></GlassPanel><DetailPanel title="Provider setup">Float account creation validates asset and offset accounts in FloatManagementEngine. Account ids come from Chart of Accounts.</DetailPanel></>} /></div>;
}
