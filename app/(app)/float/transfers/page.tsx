"use client";
import { z } from "zod";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ floatAccountId: z.string().min(10), destinationFloatAccountId: z.string().min(10), transactionDate: z.string().min(1), amount: z.string().min(1), description: z.string().min(3) });
type TransferForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/float/transactions");
  const floats = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  const workflows = useListQuery<any[]>("/api/float/workflows", ["list", "float-workflows"]);
  if (floats.isLoading) return <GlassSkeleton className="h-72" />;
  if (floats.error) return <GlassErrorState title="Float unavailable" description="Unable to load float accounts." />;
  const floatOptions: SelectOption[] = (floats.data?.data ?? []).map((f: any) => ({ value: f.id, label: `${f.provider} ${f.name}` }));
  const rows = (workflows.data?.data ?? []).map((t: any) => ({ number: t.transactionNumber, provider: t.provider ?? t.floatAccountId, date: t.transactionDate?.slice?.(0, 10) ?? t.transactionDate, amount: String(t.amount), balance: String(t.balanceAfter ?? "") }));
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Float" title="Float Transfer" description="Move float balance between two provider accounts through FloatManagementService." /><SplitWorkspace main={<><GlassPanel><ManagedForm<TransferForm> schema={schema} defaultValues={{ floatAccountId: "", destinationFloatAccountId: "", transactionDate: new Date().toLocaleDateString("en-CA"), amount: "", description: "Float transfer" }} onSubmit={async (values) => { await mutation.mutateAsync({ type: "TRANSFER", floatAccountId: values.floatAccountId, destinationFloatAccountId: values.destinationFloatAccountId, transactionDate: values.transactionDate, amount: values.amount, description: values.description }); }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<TransferForm> name="floatAccountId" label="Source float account" options={floatOptions} placeholder="Pilih sumber" /><RhfDataSelect<TransferForm> name="destinationFloatAccountId" label="Destination float account" options={floatOptions} placeholder="Pilih tujuan" /><RhfTextField<TransferForm> name="transactionDate" label="Date" placeholder="2026-05-31" /><RhfTextField<TransferForm> name="amount" label="Amount" placeholder="300000" /><RhfTextField<TransferForm> name="description" label="Description" placeholder="Float transfer" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Save transfer</button></div>}</ManagedForm></GlassPanel><GlassTable columns={[{ key: "number", header: "Number" }, { key: "provider", header: "Provider" }, { key: "date", header: "Date" }, { key: "amount", header: "Amount" }, { key: "balance", header: "Balance after" }]} rows={rows} empty="No float transactions loaded" /></>} side={<DetailPanel title="Journal preview">Transfer debits destination float asset, credits source float asset.</DetailPanel>} /></div>;
}
