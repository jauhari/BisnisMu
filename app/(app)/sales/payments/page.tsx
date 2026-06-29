"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";

const METHODS = ["CASH", "BANK", "QRIS", "FLOAT", "CUSTOMER_WALLET", "ACCOUNTS_RECEIVABLE"] as const;
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/sales/orders/payment");
  const list = useListQuery<any[]>("/api/sales/payments", ["list", "sales-payments"]);
  const orders = useListQuery<any[]>("/api/sales/orders/list", ["list", "sales-orders"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const [salesOrderId, setSalesOrderId] = useState("");
  const [method, setMethod] = useState<string>("CASH");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const cashAccounts = flat.filter((a: any) => (a.subtype === "cash" || a.subtype === "bank" || a.groupCode === 1) && a.isPostingAllowed);
  const orderList = ((orders.data as any)?.data?.rows ?? []) as any[];
  const unpaid = useMemo(() => orderList.filter((o: any) => o.status === "CONFIRMED" || o.status === "PARTIALLY_PAID"), [orderList]);
  const needsAccount = method === "CASH" || method === "BANK" || method === "QRIS";

  if (list.isLoading || orders.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Payments unavailable" description="Unable to load sales payments." />;

  async function submit() {
    setError(null); setOkMsg(null);
    if (!salesOrderId) { setError("Pilih sales order."); return; }
    if (!amount || Number(amount) <= 0) { setError("Isi jumlah pembayaran > 0."); return; }
    if (needsAccount && !accountId) { setError("Pilih akun kas/bank."); return; }
    const allocation: Record<string, unknown> = { method, amount };
    if (needsAccount) allocation.accountId = accountId;
    try {
      await mutation.mutateAsync({ salesOrderId, allocations: [allocation] });
      setOkMsg("Pembayaran dialokasikan."); setSalesOrderId(""); setAmount("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal mengalokasikan pembayaran."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((p: any) => ({ payment: p.id?.slice(-8) ?? "", customer: p.customerId ?? "-", method: p.allocations?.[0]?.method ?? "-", allocated: String(p.allocatedAmount ?? p.totalAmount ?? ""), status: p.status ?? "-" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Sales" title="Payment Allocation" description="Allocate payments to confirmed sales orders through PaymentService/SalesService." /><SplitWorkspace main={<GlassTable columns={[{ key: "payment", header: "Payment" }, { key: "customer", header: "Customer" }, { key: "method", header: "Method" }, { key: "allocated", header: "Allocated" }, { key: "status", header: "Status" }]} rows={rows} empty="No payments loaded" />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Sales order</span><GlassDataSelect value={salesOrderId} onChange={setSalesOrderId} placeholder={unpaid.length ? "Pilih order" : "Tidak ada order siap bayar"} options={unpaid.map((o: any) => ({ value: o.id, label: `${o.orderNumber ?? o.id.slice(-6)} · ${o.status} · Rp${String(o.totalAmount ?? "")}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Payment method</span><GlassDataSelect value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: m }))} className="h-10" /></label>{needsAccount ? <label className="grid gap-1"><span className="text-xs text-muted">Cash / bank account</span><GlassDataSelect value={accountId} onChange={setAccountId} placeholder="Pilih akun" options={cashAccounts.map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` }))} className="h-10" /></label> : null}<label className="grid gap-1"><span className="text-xs text-muted">Amount</span><GlassInput value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10" placeholder="0" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Allocate payment</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Allocation rules">Remaining balance, overpayment, and wallet usage are validated by existing payment services.</DetailPanel></>} /></div>;
}
