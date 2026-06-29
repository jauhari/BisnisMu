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
  vendorId: z.string().min(10),
  apAccountId: z.string().min(10),
  expenseAccountId: z.string().min(10),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  subtotal: z.string().min(1),
  ppnPercent: z.string().optional(),
  pphPercent: z.string().optional(),
  description: z.string().optional(),
});
type BillForm = z.infer<typeof schema>;

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

function TaxBreakdown({ subtotal, ppn, pph }: { subtotal: string; ppn: string; pph: string }) {
  const base = Math.max(0, Number(subtotal) || 0);
  const ppnPct = Math.min(100, Math.max(0, Number(ppn) || 0));
  const pphPct = Math.min(100, Math.max(0, Number(pph) || 0));
  const ppnAmt = Math.round(base * ppnPct / 100);
  const pphAmt = Math.round(base * pphPct / 100);
  const total = base + ppnAmt - pphAmt;
  if (!base) return null;
  return (
    <div className="rounded-md border border-border/60 bg-white/40 p-3 text-xs dark:bg-white/5 md:col-span-3">
      <div className="grid grid-cols-4 gap-2 text-muted">
        <div>Subtotal<p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{formatRupiah(base)}</p></div>
        {ppnPct > 0 ? <div>PPN {ppnPct}%<p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">+ {formatRupiah(ppnAmt)}</p></div> : null}
        {pphPct > 0 ? <div>PPh {pphPct}%<p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">− {formatRupiah(pphAmt)}</p></div> : null}
        <div className="font-semibold">Net dibayar<p className="mt-0.5 text-base font-bold text-foreground tabular-nums">{formatRupiah(total)}</p></div>
      </div>
    </div>
  );
}

export default function Page() {
  const mutation = usePostMutation("/api/ar-ap/bills");
  const vendors = useListQuery<any[]>("/api/ar-ap/vendors", ["list", "ar-ap-vendors"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const bills = useListQuery<any[]>("/api/ar-ap/payables", ["list", "ar-ap-payables"]);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const postable = flat.filter((a: any) => a.isPostingAllowed);
  const apOptions: SelectOption[] = postable.filter((a: any) => a.subtype === "accounts_payable").map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const expenseOptions: SelectOption[] = postable.filter((a: any) => a.groupCode === 6 || a.groupCode === 5).map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const vendorOptions: SelectOption[] = (vendors.data?.data ?? []).map((v: any) => ({ value: v.id, label: v.name }));

  if (accounts.isLoading || vendors.isLoading) return <GlassSkeleton className="h-72" />;

  const rows = (bills.data?.data ?? []).map((r: any) => ({ number: r.billNumber ?? r.number ?? "—", vendor: r.vendorName ?? r.vendorId, due: r.dueDate?.slice?.(0, 10) ?? r.due, status: r.status, amount: formatRupiah(r.totalAmount ?? r.subtotal ?? r.amount ?? 0) }));

  return (
    <div className="grid gap-6">
      <WorkspaceHeader eyebrow="Accounts Payable" title="Bills" description="Draft, posting, dan bayar tagihan vendor melalui ArApService. PPN dan PPh dihitung otomatis." />
      <DocumentWorkspace summary={<DocumentSummary title="Payable" lines={[{ label: "Bills", value: String(rows.length) }]} />}>
        <ManagedForm<BillForm>
          schema={schema}
          defaultValues={{ vendorId: "", apAccountId: "", expenseAccountId: "", issueDate: new Date().toLocaleDateString("en-CA"), dueDate: new Date(Date.now() + 10 * 86400000).toLocaleDateString("en-CA"), subtotal: "", ppnPercent: "0", pphPercent: "0", description: "" }}
          onSubmit={async (values) => {
            const base = Number(values.subtotal) || 0;
            const ppnPct = Math.min(100, Math.max(0, Number(values.ppnPercent) || 0));
            const pphPct = Math.min(100, Math.max(0, Number(values.pphPercent) || 0));
            const ppnAmt = Math.round(base * ppnPct / 100);
            const pphAmt = Math.round(base * pphPct / 100);
            const net = base + ppnAmt - pphAmt;
            await mutation.mutateAsync({ vendorId: values.vendorId, apAccountId: values.apAccountId, expenseAccountId: values.expenseAccountId, issueDate: values.issueDate, dueDate: values.dueDate, amount: String(net), description: values.description || "Bill", ppnPercent: ppnPct, ppnAmount: ppnAmt, pphPercent: pphPct, pphAmount: pphAmt });
          }}
        >
          {({ form }) => {
            const subtotal = form.watch("subtotal");
            const ppnPercent = form.watch("ppnPercent");
            const pphPercent = form.watch("pphPercent");
            return (
              <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3">
                <RhfDataSelect<BillForm> name="vendorId" label="Vendor" options={vendorOptions} placeholder="Pilih vendor" />
                <RhfDataSelect<BillForm> name="apAccountId" label="Akun utang (AP)" options={apOptions} placeholder="Pilih akun utang" />
                <RhfDataSelect<BillForm> name="expenseAccountId" label="Akun beban" options={expenseOptions} placeholder="Pilih akun beban" />
                <RhfTextField<BillForm> name="issueDate" label="Tanggal terbit" />
                <RhfTextField<BillForm> name="dueDate" label="Jatuh tempo" />
                <RhfTextField<BillForm> name="description" label="Keterangan (opsional)" placeholder="Pembelian barang" />
                <RhfMoneyField<BillForm> name="subtotal" label="Subtotal (sebelum pajak)" placeholder="0" />
                <RhfTextField<BillForm> name="ppnPercent" label="PPN % (cth: 11)" placeholder="0" type="number" />
                <RhfTextField<BillForm> name="pphPercent" label="PPh % potong (cth: 2)" placeholder="0" type="number" />
                <TaxBreakdown subtotal={subtotal} ppn={ppnPercent ?? "0"} pph={pphPercent ?? "0"} />
                <button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background md:col-span-3">Simpan bill draft</button>
              </div>
            );
          }}
        </ManagedForm>
        <GlassTable columns={[{ key: "number", header: "Bill" }, { key: "vendor", header: "Vendor" }, { key: "due", header: "Jatuh Tempo" }, { key: "status", header: "Status" }, { key: "amount", header: "Net" }]} rows={rows} empty="Belum ada bill." />
      </DocumentWorkspace>
    </div>
  );
}
