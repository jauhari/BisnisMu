"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Page() {
  const mutation = usePostMutation("/api/purchase/returns");
  const list = useListQuery<any[]>("/api/purchase/returns", ["list", "purchase-returns"]);
  const orders = useListQuery<any[]>("/api/purchase/orders/list", ["list", "purchase-orders"]);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const balances = useListQuery<any[]>("/api/inventory/balances", ["list", "inventory-balances"]);

  const [orderId, setOrderId] = useState("");
  const [returnDate, setReturnDate] = useState(() => todayIso());
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("main");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const orderList = (orders.data as any)?.data ?? [];
  const productList = (products.data as any)?.data ?? [];
  const knownLocations = useMemo(() => [...new Set([...(((balances.data as any)?.data ?? []).map((b: any) => b.locationId ?? b.location).filter(Boolean)), "main"])], [balances.data]);
  const productName = (id: string) => { const p = productList.find((x: any) => x.id === id); return p ? `${p.sku} ${p.name}` : id; };
  const returnable = useMemo(() => orderList.filter((o: any) => o.status === "RECEIVED" || o.status === "PARTIALLY_RECEIVED" || o.status === "COMPLETED"), [orderList]);
  const selectedOrder = returnable.find((o: any) => o.id === orderId);
  const orderItems = selectedOrder?.items ?? [];

  if (list.isLoading || orders.isLoading || products.isLoading || balances.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Purchase returns unavailable" description="Unable to load returns." />;

  function pickOrder(id: string) {
    setOrderId(id);
    const order = returnable.find((o: any) => o.id === id);
    const next: Record<string, string> = {};
    for (const it of order?.items ?? []) next[it.productId] = "0";
    setQty(next);
  }

  async function submit() {
    setError(null); setOkMsg(null);
    if (!orderId) { setError("Pilih purchase order."); return; }
    if (reason.trim().length < 3) { setError("Isi alasan retur."); return; }
    if (!location.trim()) { setError("Isi lokasi gudang."); return; }
    const items = orderItems.map((it: any) => ({ productId: it.productId, quantity: qty[it.productId] ?? "0", locationId: location.trim() })).filter((it: any) => Number(it.quantity) > 0);
    if (items.length < 1) { setError("Isi minimal 1 item dengan qty retur > 0."); return; }
    try {
      await mutation.mutateAsync({ purchaseOrderId: orderId, returnDate, reason: reason.trim(), items });
      setOkMsg("Retur pembelian tersimpan."); setOrderId(""); setReason(""); setQty({});
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan retur."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((r: any) => ({ ret: r.returnNumber ?? r.id, po: r.purchaseOrderId, date: String(r.returnDate).slice(0, 10), cost: String(r.totalCost ?? ""), journal: r.postedJournalId ?? "-" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Purchase" title="Purchase Returns" description="Return received goods to suppliers and post the reversing inventory/GRNI journal through PurchaseService." /><SplitWorkspace main={<GlassTable columns={[{ key: "ret", header: "Return" }, { key: "po", header: "PO" }, { key: "date", header: "Date" }, { key: "cost", header: "Total cost" }, { key: "journal", header: "Journal" }]} rows={rows} empty="No returns loaded" />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Purchase order</span><GlassDataSelect value={orderId} onChange={pickOrder} placeholder={returnable.length ? "Pilih PO" : "Tidak ada PO yang sudah diterima"} options={returnable.map((o: any) => ({ value: o.id, label: `${o.orderNumber ?? o.id} · ${o.status}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Return date</span><GlassInput value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Reason</span><GlassInput value={reason} onChange={(e) => setReason(e.target.value)} className="h-10" placeholder="Barang rusak / salah kirim" /></label><label className="grid gap-1"><span className="text-xs text-muted">Location (gudang)</span><GlassInput value={location} onChange={(e) => setLocation(e.target.value)} className="h-10" placeholder="main" /></label>{orderItems.length > 0 ? <div className="grid gap-2">{orderItems.map((it: any) => <div key={it.productId} className="grid items-end gap-2 md:grid-cols-[2fr_1fr]"><label className="grid gap-1"><span className="text-xs text-muted">{productName(it.productId)}</span><span className="text-xs text-muted">Received {String(it.receivedQuantity ?? 0)}</span></label><GlassInput value={qty[it.productId] ?? ""} onChange={(e) => setQty((p) => ({ ...p, [it.productId]: e.target.value }))} className="h-10" placeholder="0" /></div>)}</div> : null}<button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Create return</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Accounting impact">Returns reverse the GRNI/inventory entry and reduce on-hand stock for the returned quantities.</DetailPanel></>} /></div>;
}
