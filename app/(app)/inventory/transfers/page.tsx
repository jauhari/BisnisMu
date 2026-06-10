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
  const mutation = usePostMutation("/api/inventory/transfers");
  const list = useListQuery<any[]>("/api/inventory/transfers", ["list", "inventory-transfers"]);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const balances = useListQuery<any[]>("/api/inventory/balances", ["list", "inventory-balances"]);

  const [productId, setProductId] = useState("");
  const [fromLocation, setFromLocation] = useState("main");
  const [toLocation, setToLocation] = useState("");
  const [movementDate, setMovementDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const productList = (products.data as any)?.data ?? [];
  const knownLocations = useMemo(() => [...new Set([...(((balances.data as any)?.data ?? []).map((b: any) => b.locationId ?? b.location).filter(Boolean)), "main"])], [balances.data]);

  if (list.isLoading || products.isLoading || balances.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Inventory transfers unavailable" description="Unable to load transfers." />;

  async function submit() {
    setError(null); setOkMsg(null);
    if (!productId) { setError("Pilih produk."); return; }
    if (!fromLocation.trim() || !toLocation.trim()) { setError("Isi lokasi asal dan tujuan."); return; }
    if (fromLocation.trim() === toLocation.trim()) { setError("Lokasi asal dan tujuan harus berbeda."); return; }
    if (!quantity || Number(quantity) <= 0) { setError("Isi kuantitas transfer > 0."); return; }
    if (description.trim().length < 2) { setError("Isi deskripsi transfer."); return; }
    try {
      await mutation.mutateAsync({ productId, fromLocationId: fromLocation.trim(), toLocationId: toLocation.trim(), movementDate, quantity, description: description.trim() });
      setOkMsg("Transfer stok tersimpan."); setProductId(""); setToLocation(""); setQuantity(""); setDescription("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan transfer."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((m: any) => ({ product: m.productId, date: String(m.movementDate).slice(0, 10), quantity: String(m.quantity ?? ""), from: m.fromWarehouseId ?? "-", to: m.toWarehouseId ?? "-" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Inventory" title="Inventory Transfers" description="Transfer stock between locations. Debits source and credits destination balance." /><SplitWorkspace main={<GlassTable columns={[{ key: "product", header: "Product" }, { key: "date", header: "Date" }, { key: "quantity", header: "Quantity" }, { key: "from", header: "From" }, { key: "to", header: "To" }]} rows={rows} empty="No inventory transfers loaded" />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Product</span><GlassDataSelect value={productId} onChange={setProductId} placeholder={productList.length ? "Pilih produk" : "Belum ada produk"} options={productList.map((p: any) => ({ value: p.id, label: `${p.sku} ${p.name}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">From (gudang asal)</span><GlassInput value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} className="h-10" placeholder="main" /></label><label className="grid gap-1"><span className="text-xs text-muted">To (gudang tujuan)</span><GlassInput value={toLocation} onChange={(e) => setToLocation(e.target.value)} className="h-10" placeholder="warehouse-2" /></label><label className="grid gap-1"><span className="text-xs text-muted">Movement date</span><GlassInput value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Quantity</span><GlassInput value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10" placeholder="0" /></label><label className="grid gap-1"><span className="text-xs text-muted">Description</span><GlassInput value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" placeholder="Pindah stok ke gudang 2" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Create transfer</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Traceability">Transfer rows open product, cost history, and journal source drawers.</DetailPanel></>} /></div>;
}
