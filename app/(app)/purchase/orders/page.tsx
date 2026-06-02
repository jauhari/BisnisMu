"use client";

import { useMemo, useState } from "react";
import { DocumentSummary, DocumentWorkspace } from "@/components/layout/document-workspace";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";

interface Item { productId: string; quantity: string; unitCost: string }
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const mutation = usePostMutation("/api/purchase/orders");
  const list = useListQuery<any[]>("/api/purchase/orders/list", ["list", "purchase-orders"]);
  const vendors = useListQuery<any[]>("/api/ar-ap/vendors", ["list", "ar-ap-vendors"]);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);

  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState("2026-05-31");
  const [grniAccountId, setGrniAccountId] = useState("");
  const [apAccountId, setApAccountId] = useState("");
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: "1", unitCost: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (vendors.isLoading || products.isLoading || accounts.isLoading || list.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Purchase orders unavailable" description="Unable to load purchase orders." />;

  const vendorList = vendors.data?.data ?? [];
  const productList = products.data?.data ?? [];
  const liabilityOptions = flat.filter((a) => a.groupCode === 2 && a.isPostingAllowed);
  const apOptions = flat.filter((a) => a.subtype === "accounts_payable" && a.isPostingAllowed);
  const update = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function submit() {
    setError(null); setOkMsg(null);
    if (!supplierId) { setError("Pilih supplier."); return; }
    if (!grniAccountId || !apAccountId) { setError("Pilih GRNI account dan AP account."); return; }
    const valid = items.filter((it) => it.productId && Number(it.quantity) > 0 && it.unitCost !== "");
    if (valid.length < 1) { setError("Tambah minimal 1 item dengan produk, qty, dan unit cost."); return; }
    try {
      await mutation.mutateAsync({ supplierId, orderDate, grniAccountId, apAccountId, items: valid.map((it) => ({ productId: it.productId, quantity: it.quantity, unitCost: it.unitCost })) });
      setOkMsg("Purchase order tersimpan."); setItems([{ productId: "", quantity: "1", unitCost: "" }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan purchase order."); }
  }

  const rows = ((list.data as any)?.data ?? []).flatMap((order: any) => (order.items ?? []).map((item: any) => ({ product: item.productId, qty: String(item.quantity), received: String(item.receivedQuantity ?? 0), unitCost: String(item.unitCost), total: String(item.lineTotal) })));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Purchase" title="Purchase Orders" description="Create, approve, receive, return, and generate vendor bills through PurchaseService." /><DocumentWorkspace summary={<DocumentSummary title="Procurement summary" lines={[{ label: "Orders", value: String(((list.data as any)?.data ?? []).length) }]} />}><GlassPanel><div className="grid gap-4"><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1"><span className="text-xs text-muted">Supplier</span><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{vendorList.length ? "Pilih supplier" : "Belum ada vendor"}</option>{vendorList.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Order date</span><input value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8" /></label><label className="grid gap-1"><span className="text-xs text-muted">GRNI account (liability)</span><select value={grniAccountId} onChange={(e) => setGrniAccountId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">Pilih akun GRNI</option>{liabilityOptions.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">AP account</span><select value={apAccountId} onChange={(e) => setApAccountId(e.target.value)} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">Pilih akun utang</option>{apOptions.map((a: any) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label></div><div className="grid gap-3">{items.map((item, i) => <div key={i} className="grid items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]"><label className="grid gap-1"><span className="text-xs text-muted">Product</span><select value={item.productId} onChange={(e) => update(i, { productId: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"><option value="">{productList.length ? "Pilih produk" : "Belum ada produk"}</option>{productList.map((p: any) => <option key={p.id} value={p.id}>{p.sku} {p.name}</option>)}</select></label><label className="grid gap-1"><span className="text-xs text-muted">Qty</span><input value={item.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" /></label><label className="grid gap-1"><span className="text-xs text-muted">Unit cost</span><input value={item.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} className="h-10 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8" placeholder="0" /></label><button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length <= 1} className="h-10 rounded-md border border-border px-3 text-sm disabled:opacity-40">Hapus</button></div>)}</div><div className="flex gap-2"><button type="button" onClick={() => setItems((prev) => [...prev, { productId: "", quantity: "1", unitCost: "" }])} className="h-10 rounded-md border border-border px-4 text-sm">+ Tambah item</button><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Save purchase order</button></div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><GlassTable columns={[{ key: "product", header: "Product" }, { key: "qty", header: "Qty" }, { key: "received", header: "Received" }, { key: "unitCost", header: "Unit cost" }, { key: "total", header: "Line total" }]} rows={rows} empty="No purchase order items" /></DocumentWorkspace></div>;
}
