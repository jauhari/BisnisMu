"use client";

import { z } from "zod";
import { useMemo } from "react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ type: z.enum(["CASH_IN", "CASH_OUT", "TRANSFER"]), transactionDate: z.string().min(1), cashAccountId: z.string().min(10), counterAccountId: z.string().min(10), amount: z.string().min(1), description: z.string().min(3) });
type CashForm = z.infer<typeof schema>;

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/cash/transactions");
  const list = useListQuery<any[]>("/api/cash/transactions", ["list", "cash-transactions"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const cashOptions: SelectOption[] = flat.filter((a) => (a.subtype === "cash" || a.subtype === "bank") && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const counterOptions: SelectOption[] = flat.filter((a) => a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));

  if (accounts.isLoading) return <GlassSkeleton className="h-72" />;

  const rows = ((list.data as any)?.data ?? []).map((tx: any) => ({ number: tx.transactionNumber, type: tx.type, date: tx.transactionDate?.slice?.(0, 10) ?? tx.transactionDate, status: tx.status, amount: String(tx.amount) }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Cash Management" title="Cash Transactions" description="Cash in, cash out, and transfer draft/post/void workflows through CashManagementService with journal preview." /><SplitWorkspace main={<><ManagedForm<CashForm> schema={schema} defaultValues={{ type: "CASH_IN", transactionDate: "2026-05-31", cashAccountId: "", counterAccountId: "", amount: "", description: "" }} onSubmit={async (values) => { const isTransfer = values.type === "TRANSFER"; const payload: Record<string, unknown> = { type: values.type, transactionDate: values.transactionDate, cashAccountId: values.cashAccountId, amount: values.amount, description: values.description }; if (isTransfer) payload.destinationAccountId = values.counterAccountId; else payload.categoryAccountId = values.counterAccountId; await mutation.mutateAsync(payload); }}>{({ form }) => { const isTransfer = form.watch("type") === "TRANSFER"; return <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3"><RhfDataSelect<CashForm> name="type" label="Type" options={[{ value: "CASH_IN", label: "Cash In" }, { value: "CASH_OUT", label: "Cash Out" }, { value: "TRANSFER", label: "Transfer" }]} placeholder="Pilih tipe" /><RhfTextField<CashForm> name="transactionDate" label="Date" placeholder="2026-05-31" /><RhfTextField<CashForm> name="amount" label="Amount" placeholder="1200000" /><RhfDataSelect<CashForm> name="cashAccountId" label="Cash / bank account" options={cashOptions} placeholder="Pilih akun kas/bank" /><RhfDataSelect<CashForm> name="counterAccountId" label={isTransfer ? "Destination cash/bank account" : "Category account"} options={isTransfer ? cashOptions : counterOptions} placeholder="Pilih akun" /><RhfTextField<CashForm> name="description" label="Description" placeholder="Description" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background md:col-span-3">Save draft</button></div>; }}</ManagedForm><GlassTable columns={[{ key: "number", header: "Number" }, { key: "type", header: "Type" }, { key: "date", header: "Date" }, { key: "status", header: "Status" }, { key: "amount", header: "Amount" }]} rows={rows} empty="No cash transactions loaded" /></>} side={<><DetailPanel title="Journal preview">Cash in debits cash/bank, credits category. Cash out reverses. Transfer moves between cash/bank accounts.</DetailPanel><DetailPanel title="Void policy">Posted transactions are voided through reversing journal entries with required reason.</DetailPanel></>} /></div>;
}
