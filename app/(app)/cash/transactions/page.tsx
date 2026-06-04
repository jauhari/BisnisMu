"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { FormDrawer } from "@/components/layout/form-drawer";
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

  const [drawerOpen, setDrawerOpen] = useState(false);

  if (accounts.isLoading) return <GlassSkeleton className="h-72" />;

  const rows = ((list.data as any)?.data ?? []).map((tx: any) => ({ number: tx.transactionNumber, type: tx.type, date: tx.transactionDate?.slice?.(0, 10) ?? tx.transactionDate, status: tx.status, amount: String(tx.amount) }));

  const addButton = <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background"><Plus className="h-4 w-4" />Transaksi Baru</button>;

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Cash Management" title="Cash Transactions" description="Cash in, cash out, and transfer draft/post/void workflows through CashManagementService with journal preview." action={addButton} /><SplitWorkspace main={<GlassTable columns={[{ key: "number", header: "Number" }, { key: "type", header: "Type" }, { key: "date", header: "Date" }, { key: "status", header: "Status" }, { key: "amount", header: "Amount" }]} rows={rows} empty="Belum ada transaksi kas. Klik “Transaksi Baru”." />} side={<><DetailPanel title="Journal preview">Cash in debits cash/bank, credits category. Cash out reverses. Transfer moves between cash/bank accounts.</DetailPanel><DetailPanel title="Void policy">Posted transactions are voided through reversing journal entries with required reason.</DetailPanel></>} />
    <FormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Transaksi kas baru" subtitle="Catat kas masuk, kas keluar, atau transfer antar akun.">
    <ManagedForm<CashForm> schema={schema} defaultValues={{ type: "CASH_IN", transactionDate: new Date().toISOString().slice(0, 10), cashAccountId: "", counterAccountId: "", amount: "", description: "" }} onSubmit={async (values) => { const isTransfer = values.type === "TRANSFER"; const payload: Record<string, unknown> = { type: values.type, transactionDate: values.transactionDate, cashAccountId: values.cashAccountId, amount: values.amount, description: values.description }; if (isTransfer) payload.destinationAccountId = values.counterAccountId; else payload.categoryAccountId = values.counterAccountId; await mutation.mutateAsync(payload); setDrawerOpen(false); }}>{({ form }) => { const isTransfer = form.watch("type") === "TRANSFER"; return <div className="grid gap-4 sm:grid-cols-2"><RhfDataSelect<CashForm> name="type" label="Type" options={[{ value: "CASH_IN", label: "Cash In" }, { value: "CASH_OUT", label: "Cash Out" }, { value: "TRANSFER", label: "Transfer" }]} placeholder="Pilih tipe" /><RhfTextField<CashForm> name="transactionDate" label="Date" placeholder="2026-05-31" /><RhfTextField<CashForm> name="amount" label="Amount" placeholder="1200000" /><RhfDataSelect<CashForm> name="cashAccountId" label="Cash / bank account" options={cashOptions} placeholder="Pilih akun kas/bank" /><RhfDataSelect<CashForm> name="counterAccountId" label={isTransfer ? "Destination cash/bank account" : "Category account"} options={isTransfer ? cashOptions : counterOptions} placeholder="Pilih akun" /><RhfTextField<CashForm> name="description" label="Description" placeholder="Description" /><button type="submit" className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background sm:col-span-2">Simpan draft</button></div>; }}</ManagedForm>
    </FormDrawer>
  </div>;
}
