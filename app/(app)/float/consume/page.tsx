"use client";
import { z } from "zod";
import { useMemo } from "react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ floatAccountId: z.string().min(10), expenseAccountId: z.string().min(10), transactionDate: z.string().min(1), amount: z.string().min(1), description: z.string().min(3) });
type ConsumeForm = z.infer<typeof schema>;
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/float/transactions");
  const floats = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const workflows = useListQuery<any[]>("/api/float/workflows", ["list", "float-workflows"]);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  if (floats.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (floats.error || accounts.error) return <GlassErrorState title="Float unavailable" description="Unable to load float data." />;
  const floatOptions: SelectOption[] = (floats.data?.data ?? []).map((f: any) => ({ value: f.id, label: `${f.provider} ${f.name}` }));
  const expenseOptions: SelectOption[] = flat.filter((a) => (a.groupCode === 5 || a.groupCode === 6) && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const rows = (workflows.data?.data ?? []).map((t: any) => ({ number: t.transactionNumber, provider: t.provider ?? t.floatAccountId, date: t.transactionDate?.slice?.(0, 10) ?? t.transactionDate, amount: String(t.amount), balance: String(t.balanceAfter ?? "") }));
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Float" title="Float Consume" description="Consume provider float against an expense/COGS account through FloatManagementService." /><SplitWorkspace main={<><GlassPanel><ManagedForm<ConsumeForm> schema={schema} defaultValues={{ floatAccountId: "", expenseAccountId: "", transactionDate: new Date().toLocaleDateString("en-CA"), amount: "", description: "Float consumption" }} onSubmit={async (values) => { await mutation.mutateAsync({ type: "CONSUME", floatAccountId: values.floatAccountId, expenseAccountId: values.expenseAccountId, transactionDate: values.transactionDate, amount: values.amount, description: values.description }); }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<ConsumeForm> name="floatAccountId" label="Float account" options={floatOptions} placeholder="Pilih float account" /><RhfDataSelect<ConsumeForm> name="expenseAccountId" label="Expense / COGS account" options={expenseOptions} placeholder="Pilih akun beban" /><RhfTextField<ConsumeForm> name="transactionDate" label="Date" placeholder="2026-05-31" /><RhfTextField<ConsumeForm> name="amount" label="Amount" placeholder="500000" /><RhfTextField<ConsumeForm> name="description" label="Description" placeholder="Float consumption" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Save consume</button></div>}</ManagedForm></GlassPanel><GlassTable columns={[{ key: "number", header: "Number" }, { key: "provider", header: "Provider" }, { key: "date", header: "Date" }, { key: "amount", header: "Amount" }, { key: "balance", header: "Balance after" }]} rows={rows} empty="No float transactions loaded" /></>} side={<DetailPanel title="Journal preview">Consume debits expense/COGS, credits float asset.</DetailPanel>} /></div>;
}
