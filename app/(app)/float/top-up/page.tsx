"use client";
import { z } from "zod";
import { useMemo } from "react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ floatAccountId: z.string().min(10), cashAccountId: z.string().min(10), transactionDate: z.string().min(1), amount: z.string().min(1), description: z.string().min(3) });
type TopupForm = z.infer<typeof schema>;
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
  const cashOptions: SelectOption[] = flat.filter((a) => (a.subtype === "cash" || a.subtype === "bank") && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const rows = (workflows.data?.data ?? []).map((t: any) => ({ number: t.transactionNumber, provider: t.provider ?? t.floatAccountId, date: t.transactionDate?.slice?.(0, 10) ?? t.transactionDate, amount: String(t.amount), balance: String(t.balanceAfter ?? "") }));
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Float" title="Float Top-up" description="Top up provider float from a cash/bank account through FloatManagementService." /><SplitWorkspace main={<><GlassPanel><ManagedForm<TopupForm> schema={schema} defaultValues={{ floatAccountId: "", cashAccountId: "", transactionDate: "2026-05-31", amount: "", description: "Float top-up" }} onSubmit={async (values) => { await mutation.mutateAsync({ type: "TOPUP", floatAccountId: values.floatAccountId, cashAccountId: values.cashAccountId, transactionDate: values.transactionDate, amount: values.amount, description: values.description }); }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<TopupForm> name="floatAccountId" label="Float account" options={floatOptions} placeholder="Pilih float account" /><RhfDataSelect<TopupForm> name="cashAccountId" label="Cash / bank account" options={cashOptions} placeholder="Pilih akun kas/bank" /><RhfTextField<TopupForm> name="transactionDate" label="Date" placeholder="2026-05-31" /><RhfTextField<TopupForm> name="amount" label="Amount" placeholder="800000" /><RhfTextField<TopupForm> name="description" label="Description" placeholder="Float top-up" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Save top-up</button></div>}</ManagedForm></GlassPanel><GlassTable columns={[{ key: "number", header: "Number" }, { key: "provider", header: "Provider" }, { key: "date", header: "Date" }, { key: "amount", header: "Amount" }, { key: "balance", header: "Balance after" }]} rows={rows} empty="No float transactions loaded" /></>} side={<DetailPanel title="Journal preview">Top-up debits float asset, credits cash/bank.</DetailPanel>} /></div>;
}
