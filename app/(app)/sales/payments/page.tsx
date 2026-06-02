"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";

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
  const orderList = ((orders.data as any)?.data ?? []) as any[];
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

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Sales" title="Payment Allocation" description="Allocate payments to confirmed sales orders through PaymentService/SalesService." /><SplitWorkspace main={<GlassTable columns={[{ key: "payment", header: "Payment" }, { key: "customer", header: "Customer" }, { key: "method", header: "Method" }, { key: "allocated", header: "Allocated" }, { key: "status", header: "Status" }]} rows={rows} empty="No payments loaded" />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Sales order</span><select value={salesOrderId} onChange={(e) => setSalesOrderId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{unpaid.length ? "Pilih order" : "Tidak ada order siap bayar"}</option>{unpaid.map((o: any) => <option key={o.id} value={o.id}>{o.orderNumber ?? o.id.slice(-6)} · {o.status} · Rp{String(o.totalAmount ?? "")}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Payment method</span><select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8">{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>{needsAccount ? <label className="grid gap-1"><span className="text-xs text-muted">Cash / bank account</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">Pilih akun</option>{cashAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label> : null}<label className="grid gap-1"><span className="text-xs text-muted">Amount</span><input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" placeholder="0" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Allocate payment</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Allocation rules">Remaining balance, overpayment, and wallet usage are validated by existing payment services.</DetailPanel></>} /></div>;
}
