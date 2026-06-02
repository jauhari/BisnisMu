"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DocumentSummary, DocumentWorkspace } from "@/components/layout/document-workspace";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { apiRequest } from "@/presentation/api/client";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";

interface Item { productId: string; quantity: string; unitPrice: string }
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/sales/orders");
  const list = useQuery({ queryKey: ["list", "sales-orders-list"], queryFn: () => apiRequest<{ data: { rows: any[]; total: number } }>("/api/sales/orders/list") });
  const customers = useListQuery<any[]>("/api/sales/customers", ["list", "sales-customers"]);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);

  const [customerId, setCustomerId] = useState("");
  const [saleDate, setSaleDate] = useState("2026-05-31");
  const [settlementAccountId, setSettlementAccountId] = useState("");
  const [description, setDescription] = useState("Sales order");
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: "1", unitPrice: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (customers.isLoading || products.isLoading || accounts.isLoading || list.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Sales orders unavailable" description="Unable to load sales orders." />;

  const productList = products.data?.data ?? [];
  const customerList = customers.data?.data ?? [];
  const settlementOptions = flat.filter((a) => a.groupCode === 4 && a.isPostingAllowed);
  const update = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function submit() {
    setError(null); setOkMsg(null);
    if (!customerId) { setError("Pilih customer."); return; }
    if (!settlementAccountId) { setError("Pilih revenue account."); return; }
    const valid = items.filter((it) => it.productId && Number(it.quantity) > 0);
    if (valid.length < 1) { setError("Tambah minimal 1 item dengan produk dan qty."); return; }
    try {
      await mutation.mutateAsync({ customerId, saleDate, description, revenueSettlementAccountId: settlementAccountId, items: valid.map((it) => ({ productId: it.productId, quantity: it.quantity, ...(it.unitPrice ? { unitPrice: it.unitPrice } : {}) })) });
      setOkMsg("Sales order tersimpan."); setItems([{ productId: "", quantity: "1", unitPrice: "" }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan sales order."); }
  }

  const rows = (list.data?.data.rows ?? []).flatMap((row: any) => (row.items ?? []).map((item: any) => ({ product: item.productId, qty: String(item.quantity), price: String(item.unitPrice), total: String(item.lineTotal) })));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Sales" title="Sales Orders" description="Create, confirm, and allocate payments through SalesService while preserving inventory/payment/accounting integrations." /><DocumentWorkspace summary={<DocumentSummary title="Order summary" lines={[{ label: "Orders", value: String(list.data?.data.total ?? 0) }]} />}><GlassPanel><div className="grid gap-4"><div className="grid gap-4 md:grid-cols-3"><label className="grid gap-1"><span className="text-xs text-muted">Customer</span><select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{customerList.length ? "Pilih customer" : "Belum ada customer"}</option>{customerList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Revenue account</span><select value={settlementAccountId} onChange={(e) => setSettlementAccountId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">Pilih akun pendapatan</option>{settlementOptions.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Sale date</span><input value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" /></label></div><label className="grid gap-1"><span className="text-xs text-muted">Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" /></label><div className="grid gap-3">{items.map((item, i) => <div key={i} className="grid items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"><label className="grid gap-1"><span className="text-xs text-muted">Product</span><select value={item.productId} onChange={(e) => update(i, { productId: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{productList.length ? "Pilih produk" : "Belum ada produk"}</option>{productList.map((p: any) => <option key={p.id} value={p.id}>{p.sku} {p.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Qty</span><input value={item.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" /></label><label className="grid gap-1"><span className="text-xs text-muted">Unit price (opsional)</span><input value={item.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" placeholder="auto" /></label><button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length <= 1} className="h-10 rounded-md border border-border px-3 text-sm disabled:opacity-40">Hapus</button></div>)}</div><div className="flex gap-2"><button type="button" onClick={() => setItems((prev) => [...prev, { productId: "", quantity: "1", unitPrice: "" }])} className="h-10 rounded-md border border-border px-4 text-sm">+ Tambah item</button><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Save sales order</button></div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><GlassTable columns={[{ key: "product", header: "Product" }, { key: "qty", header: "Qty" }, { key: "price", header: "Price" }, { key: "total", header: "Line total" }]} rows={rows} empty="No sales order items" /></DocumentWorkspace></div>;
}
