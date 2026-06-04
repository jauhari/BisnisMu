"use client";

import { z } from "zod";
import { useMemo } from "react";
import { ManagedForm, RhfTextField, RhfMoneyField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { DocumentSummary, DocumentWorkspace } from "@/components/layout/document-workspace";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { formatRupiah } from "@/presentation/format/number";

const schema = z.object({
  customerId: z.string().min(10),
  arAccountId: z.string().min(10),
  revenueAccountId: z.string().min(10),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  subtotal: z.string().min(1),
  ppnPercent: z.string().optional(),
  description: z.string().optional(),
});
type InvoiceForm = z.infer<typeof schema>;

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

function TaxBreakdown({ subtotal, ppn }: { subtotal: string; ppn: string }) {
  const base = Math.max(0, Number(subtotal) || 0);
  const ppnPct = Math.min(100, Math.max(0, Number(ppn) || 0));
  const ppnAmt = Math.round(base * ppnPct / 100);
  const total = base + ppnAmt;
  if (!base) return null;
  return (
    <div className="rounded-md border border-border/60 bg-white/40 p-3 text-xs dark:bg-white/5 md:col-span-3">
      <div className="grid grid-cols-3 gap-2 text-muted">
        <div>Subtotal<p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{formatRupiah(base)}</p></div>
        {ppnPct > 0 ? <div>PPN {ppnPct}%<p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">+ {formatRupiah(ppnAmt)}</p></div> : null}
        <div className="font-semibold">Total<p className="mt-0.5 text-base font-bold text-foreground tabular-nums">{formatRupiah(total)}</p></div>
      </div>
    </div>
  );
}

export default function Page() {
  const mutation = usePostMutation("/api/ar-ap/invoices");
  const customers = useListQuery<any[]>("/api/ar-ap/customers", ["list", "ar-ap-customers"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const invoices = useListQuery<any[]>("/api/ar-ap/receivables", ["list", "ar-ap-receivables"]);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const postable = flat.filter((a: any) => a.isPostingAllowed);
  const arOptions: SelectOption[] = postable.filter((a: any) => a.subtype === "accounts_receivable").map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const revenueOptions: SelectOption[] = postable.filter((a: any) => a.groupCode === 4).map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const customerOptions: SelectOption[] = (customers.data?.data ?? []).map((c: any) => ({ value: c.id, label: c.name }));

  if (accounts.isLoading || customers.isLoading) return <GlassSkeleton className="h-72" />;

  const rows = (invoices.data?.data ?? []).map((r: any) => ({ number: r.invoiceNumber ?? r.number ?? "—", customer: r.customerName ?? r.customerId, due: r.dueDate?.slice?.(0, 10) ?? r.due, status: r.status, amount: formatRupiah(r.totalAmount ?? r.subtotal ?? r.amount ?? 0) }));

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="Accounts Receivable" title="Invoices" description="Draft, posting, dan penyelesaian invoice melalui ArApService. PPN dihitung otomatis." />
      <DocumentWorkspace summary={<DocumentSummary title="Receivable" lines={[{ label: "Invoices", value: String(rows.length) }]} />}>
        <ManagedForm<InvoiceForm>
          schema={schema}
          defaultValues={{ customerId: "", arAccountId: "", revenueAccountId: "", issueDate: new Date().toLocaleDateString("en-CA"), dueDate: new Date(Date.now() + 14 * 86400000).toLocaleDateString("en-CA"), subtotal: "", ppnPercent: "0", description: "" }}
          onSubmit={async (values) => {
            const base = Number(values.subtotal) || 0;
            const ppnPct = Math.min(100, Math.max(0, Number(values.ppnPercent) || 0));
            const ppnAmt = Math.round(base * ppnPct / 100);
            const total = base + ppnAmt;
            await mutation.mutateAsync({ customerId: values.customerId, arAccountId: values.arAccountId, revenueAccountId: values.revenueAccountId, issueDate: values.issueDate, dueDate: values.dueDate, amount: String(total), description: values.description || "Invoice", ppnPercent: ppnPct, ppnAmount: ppnAmt });
          }}
        >
          {({ form }) => {
            const subtotal = form.watch("subtotal");
            const ppnPercent = form.watch("ppnPercent");
            return (
              <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3">
                <RhfDataSelect<InvoiceForm> name="customerId" label="Customer" options={customerOptions} placeholder="Pilih customer" />
                <RhfDataSelect<InvoiceForm> name="arAccountId" label="Akun piutang (AR)" options={arOptions} placeholder="Pilih akun piutang" />
                <RhfDataSelect<InvoiceForm> name="revenueAccountId" label="Akun pendapatan" options={revenueOptions} placeholder="Pilih akun pendapatan" />
                <RhfTextField<InvoiceForm> name="issueDate" label="Tanggal terbit" />
                <RhfTextField<InvoiceForm> name="dueDate" label="Jatuh tempo" />
                <RhfTextField<InvoiceForm> name="description" label="Keterangan (opsional)" placeholder="Penjualan barang" />
                <RhfMoneyField<InvoiceForm> name="subtotal" label="Subtotal (sebelum pajak)" placeholder="0" />
                <RhfTextField<InvoiceForm> name="ppnPercent" label="PPN % (opsional, cth: 11)" placeholder="0" type="number" />
                <TaxBreakdown subtotal={subtotal} ppn={ppnPercent ?? "0"} />
                <button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background md:col-span-3">Simpan invoice draft</button>
              </div>
            );
          }}
        </ManagedForm>
        <GlassTable columns={[{ key: "number", header: "Invoice" }, { key: "customer", header: "Customer" }, { key: "due", header: "Jatuh Tempo" }, { key: "status", header: "Status" }, { key: "amount", header: "Total" }]} rows={rows} empty="Belum ada invoice." />
      </DocumentWorkspace>
    </div>
  );
}
