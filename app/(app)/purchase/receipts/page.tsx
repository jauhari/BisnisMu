"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";

const today = new Date().toISOString().slice(0, 10);

export default function Page() {
  const mutation = usePostMutation("/api/purchase/receipts");
  const list = useListQuery<any[]>("/api/purchase/receipts", ["list", "purchase-receipts"]);
  const orders = useListQuery<any[]>("/api/purchase/orders/list", ["list", "purchase-orders"]);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const balances = useListQuery<any[]>("/api/inventory/balances", ["list", "inventory-balances"]);

  const [orderId, setOrderId] = useState("");
  const [receiptDate, setReceiptDate] = useState(today);
  const [location, setLocation] = useState("main");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const orderList = (orders.data as any)?.data ?? [];
  const productList = (products.data as any)?.data ?? [];
  const knownLocations = useMemo(() => [...new Set([...(((balances.data as any)?.data ?? []).map((b: any) => b.locationId ?? b.location).filter(Boolean)), "main"])], [balances.data]);
  const productName = (id: string) => { const p = productList.find((x: any) => x.id === id); return p ? `${p.sku} ${p.name}` : id; };
  const receivable = useMemo(() => orderList.filter((o: any) => o.status !== "COMPLETED" && o.status !== "CANCELLED"), [orderList]);
  const selectedOrder = receivable.find((o: any) => o.id === orderId);
  const orderItems = selectedOrder?.items ?? [];

  if (list.isLoading || orders.isLoading || products.isLoading || balances.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Purchase receipts unavailable" description="Unable to load receipts." />;

  function pickOrder(id: string) {
    setOrderId(id);
    const order = receivable.find((o: any) => o.id === id);
    const next: Record<string, string> = {};
    for (const it of order?.items ?? []) next[it.productId] = String(Math.max(0, Number(it.quantity) - Number(it.receivedQuantity ?? 0)));
    setQty(next);
  }

  async function submit() {
    setError(null); setOkMsg(null);
    if (!orderId) { setError("Pilih purchase order."); return; }
    if (!location.trim()) { setError("Isi lokasi gudang."); return; }
    const items = orderItems.map((it: any) => ({ productId: it.productId, quantity: qty[it.productId] ?? "0", locationId: location.trim() })).filter((it: any) => Number(it.quantity) > 0);
    if (items.length < 1) { setError("Isi minimal 1 item dengan qty diterima > 0."); return; }
    try {
      await mutation.mutateAsync({ purchaseOrderId: orderId, receiptDate, items });
      setOkMsg("Penerimaan barang tersimpan."); setOrderId(""); setQty({});
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan penerimaan."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((r: any) => ({ receipt: r.receiptNumber ?? r.id, po: r.purchaseOrderId, date: String(r.receiptDate).slice(0, 10), cost: String(r.totalCost ?? ""), journal: r.journalId ?? "-" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Purchase" title="Purchase Receipts" description="Receive purchase orders and post inventory/GRNI impact through PurchaseService and InventoryService." /><SplitWorkspace main={<GlassTable columns={[{ key: "receipt", header: "Receipt" }, { key: "po", header: "PO" }, { key: "date", header: "Date" }, { key: "cost", header: "Total cost" }, { key: "journal", header: "Journal" }]} rows={rows} empty="No receipts loaded" />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Purchase order</span><GlassDataSelect value={orderId} onChange={pickOrder} placeholder={receivable.length ? "Pilih PO" : "Tidak ada PO yang bisa diterima"} options={receivable.map((o: any) => ({ value: o.id, label: `${o.orderNumber ?? o.id} · ${o.status}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Receipt date</span><GlassInput value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Location (gudang)</span><GlassInput value={location} onChange={(e) => setLocation(e.target.value)} className="h-10" placeholder="main" /></label>{orderItems.length > 0 ? <div className="grid gap-2">{orderItems.map((it: any) => <div key={it.productId} className="grid items-end gap-2 md:grid-cols-[2fr_1fr]"><label className="grid gap-1"><span className="text-xs text-muted">{productName(it.productId)}</span><span className="text-xs text-muted">Ordered {String(it.quantity)} · received {String(it.receivedQuantity ?? 0)}</span></label><GlassInput value={qty[it.productId] ?? ""} onChange={(e) => setQty((p) => ({ ...p, [it.productId]: e.target.value }))} className="h-10" placeholder="0" /></div>)}</div> : null}<button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Receive order</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Inventory impact">Receipt lines update stock balances and average cost through existing inventory flows.</DetailPanel></>} /></div>;
}
