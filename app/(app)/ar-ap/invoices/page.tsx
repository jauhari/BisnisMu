"use client";

import { z } from "zod";
import { useMemo } from "react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { DocumentSummary, DocumentWorkspace } from "@/components/layout/document-workspace";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ customerId: z.string().min(10), arAccountId: z.string().min(10), revenueAccountId: z.string().min(10), issueDate: z.string().min(1), dueDate: z.string().min(1), amount: z.string().min(1) });
type InvoiceForm = z.infer<typeof schema>;

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/ar-ap/invoices");
  const customers = useListQuery<any[]>("/api/ar-ap/customers", ["list", "ar-ap-customers"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const invoices = useListQuery<any[]>("/api/ar-ap/receivables", ["list", "ar-ap-receivables"]);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const customerOptions: SelectOption[] = (customers.data?.data ?? []).map((c: any) => ({ value: c.id, label: c.name }));
  const arOptions: SelectOption[] = flat.filter((a) => a.subtype === "accounts_receivable" && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const revenueOptions: SelectOption[] = flat.filter((a) => a.groupCode === 4 && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));

  if (customers.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;

  const rows = (invoices.data?.data ?? []).map((r: any) => ({ number: r.invoiceNumber ?? r.number, customer: r.customerName ?? r.customerId, due: r.dueDate?.slice?.(0, 10) ?? r.due, status: r.status, amount: String(r.subtotal ?? r.amount ?? "") }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Accounts Receivable" title="Invoices" description="Draft, post, trace, and settle invoices through ArApService." /><DocumentWorkspace summary={<DocumentSummary title="Receivable" lines={[{ label: "Invoices", value: String(rows.length) }]} />}><ManagedForm<InvoiceForm> schema={schema} defaultValues={{ customerId: "", arAccountId: "", revenueAccountId: "", issueDate: "2026-05-31", dueDate: "2026-06-14", amount: "" }} onSubmit={async (values) => { await mutation.mutateAsync({ customerId: values.customerId, arAccountId: values.arAccountId, revenueAccountId: values.revenueAccountId, issueDate: values.issueDate, dueDate: values.dueDate, amount: values.amount, description: "Invoice" }); }}>{() => <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3"><RhfDataSelect<InvoiceForm> name="customerId" label="Customer" options={customerOptions} placeholder="Pilih customer" /><RhfDataSelect<InvoiceForm> name="arAccountId" label="Piutang (AR) account" options={arOptions} placeholder="Pilih akun piutang" /><RhfDataSelect<InvoiceForm> name="revenueAccountId" label="Revenue account" options={revenueOptions} placeholder="Pilih akun pendapatan" /><RhfTextField<InvoiceForm> name="issueDate" label="Issue date" placeholder="2026-05-31" /><RhfTextField<InvoiceForm> name="dueDate" label="Due date" placeholder="2026-06-14" /><RhfTextField<InvoiceForm> name="amount" label="Amount" placeholder="2400000" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background md:col-span-3">Save invoice draft</button></div>}</ManagedForm><GlassTable columns={[{ key: "number", header: "Invoice" }, { key: "customer", header: "Customer" }, { key: "due", header: "Due" }, { key: "status", header: "Status" }, { key: "amount", header: "Amount" }]} rows={rows} empty="No invoices loaded" /></DocumentWorkspace></div>;
}
