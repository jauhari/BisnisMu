"use client";

import { z } from "zod";
import { useMemo } from "react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { DocumentSummary, DocumentWorkspace } from "@/components/layout/document-workspace";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ vendorId: z.string().min(10), apAccountId: z.string().min(10), expenseAccountId: z.string().min(10), issueDate: z.string().min(1), dueDate: z.string().min(1), amount: z.string().min(1) });
type BillForm = z.infer<typeof schema>;

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/ar-ap/bills");
  const vendors = useListQuery<any[]>("/api/ar-ap/vendors", ["list", "ar-ap-vendors"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const bills = useListQuery<any[]>("/api/ar-ap/payables", ["list", "ar-ap-payables"]);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const vendorOptions: SelectOption[] = (vendors.data?.data ?? []).map((v: any) => ({ value: v.id, label: v.name }));
  const apOptions: SelectOption[] = flat.filter((a) => a.subtype === "accounts_payable" && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const expenseOptions: SelectOption[] = flat.filter((a) => a.groupCode === 6 && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));

  if (vendors.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;

  const rows = (bills.data?.data ?? []).map((r: any) => ({ number: r.billNumber ?? r.number, vendor: r.vendorName ?? r.vendorId, due: r.dueDate?.slice?.(0, 10) ?? r.due, status: r.status, amount: String(r.subtotal ?? r.amount ?? "") }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Accounts Payable" title="Bills" description="Draft, post, pay, and trace vendor bills through ArApService." /><DocumentWorkspace summary={<DocumentSummary title="Payable" lines={[{ label: "Bills", value: String(rows.length) }]} />}><ManagedForm<BillForm> schema={schema} defaultValues={{ vendorId: "", apAccountId: "", expenseAccountId: "", issueDate: "2026-05-31", dueDate: "2026-06-10", amount: "" }} onSubmit={async (values) => { await mutation.mutateAsync({ vendorId: values.vendorId, apAccountId: values.apAccountId, expenseAccountId: values.expenseAccountId, issueDate: values.issueDate, dueDate: values.dueDate, amount: values.amount, description: "Bill" }); }}>{() => <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3"><RhfDataSelect<BillForm> name="vendorId" label="Vendor" options={vendorOptions} placeholder="Pilih vendor" /><RhfDataSelect<BillForm> name="apAccountId" label="Utang (AP) account" options={apOptions} placeholder="Pilih akun utang" /><RhfDataSelect<BillForm> name="expenseAccountId" label="Expense account" options={expenseOptions} placeholder="Pilih akun beban" /><RhfTextField<BillForm> name="issueDate" label="Issue date" placeholder="2026-05-31" /><RhfTextField<BillForm> name="dueDate" label="Due date" placeholder="2026-06-10" /><RhfTextField<BillForm> name="amount" label="Amount" placeholder="3100000" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background md:col-span-3">Save bill draft</button></div>}</ManagedForm><GlassTable columns={[{ key: "number", header: "Bill" }, { key: "vendor", header: "Vendor" }, { key: "due", header: "Due" }, { key: "status", header: "Status" }, { key: "amount", header: "Amount" }]} rows={rows} empty="No bills loaded" /></DocumentWorkspace></div>;
}
