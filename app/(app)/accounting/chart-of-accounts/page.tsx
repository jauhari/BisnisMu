"use client";
import { z } from "zod";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ code: z.string().regex(/^[1-7]\d{5}$/, "6 digit, awali 1-7"), name: z.string().min(3), groupCode: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE", "OTHER_EXPENSE"]), normalBalance: z.enum(["DEBIT", "CREDIT"]) });
type CoaForm = z.infer<typeof schema>;

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }
const GROUP_OPTIONS: SelectOption[] = [{ value: "ASSET", label: "1 - Asset (DEBIT)" }, { value: "LIABILITY", label: "2 - Liability (CREDIT)" }, { value: "EQUITY", label: "3 - Equity (CREDIT)" }, { value: "REVENUE", label: "4 - Revenue (CREDIT)" }, { value: "COGS", label: "5 - COGS (DEBIT)" }, { value: "EXPENSE", label: "6 - Expense (DEBIT)" }, { value: "OTHER_EXPENSE", label: "7 - Other Expense (DEBIT)" }];

export default function Page() {
  const mutation = usePostMutation("/api/accounting/chart-of-accounts");
  const seed = usePostMutation("/api/accounting/chart-of-accounts/seed");
  const { data, isLoading, error } = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Accounts unavailable" description="Unable to load chart of accounts." />;
  const rows = flattenAccounts(data.data ?? []).map((a: any) => ({ code: a.code, name: a.name, group: a.groupCode, normal: a.normalBalance, status: a.isActive ? "Active" : "Inactive" }));
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Accounting" title="Chart of Accounts" description="SAK EMKM account hierarchy managed by ChartOfAccountsService." action={rows.length === 0 ? <button onClick={() => seed.mutate({})} className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background">Seed SAK EMKM accounts</button> : undefined} /><SplitWorkspace main={<GlassTable columns={[{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "group", header: "Group" }, { key: "normal", header: "Normal balance" }, { key: "status", header: "Status" }]} rows={rows} empty="No accounts. Use Seed SAK EMKM accounts." />} side={<><GlassPanel><ManagedForm<CoaForm> schema={schema} defaultValues={{ code: "", name: "", groupCode: "ASSET", normalBalance: "DEBIT" }} onSubmit={async (values) => { await mutation.mutateAsync(values); }}>{() => <div className="grid gap-4"><RhfTextField<CoaForm> name="code" label="Account code" placeholder="110103" /><RhfTextField<CoaForm> name="name" label="Account name" placeholder="Kas Operasional" /><RhfDataSelect<CoaForm> name="groupCode" label="Group" options={GROUP_OPTIONS} placeholder="Pilih grup" /><RhfDataSelect<CoaForm> name="normalBalance" label="Normal balance" options={[{ value: "DEBIT", label: "DEBIT" }, { value: "CREDIT", label: "CREDIT" }]} placeholder="Pilih normal balance" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Save account</button></div>}</ManagedForm></GlassPanel><DetailPanel title="Rules">Kode harus diawali digit grup: Asset=1, Liability=2, Equity=3, Revenue=4, COGS=5, Expense=6, Other Expense=7. Normal balance harus sesuai grup.</DetailPanel></>} /></div>;
}
