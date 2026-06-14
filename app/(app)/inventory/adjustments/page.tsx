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
  const mutation = usePostMutation("/api/inventory/adjustments");
  const list = useListQuery<any[]>("/api/inventory/adjustments", ["list", "inventory-adjustments"]);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const balances = useListQuery<any[]>("/api/inventory/balances", ["list", "inventory-balances"]);

  const [productId, setProductId] = useState("");
  const [location, setLocation] = useState("main");
  const [movementDate, setMovementDate] = useState(() => todayIso());
  const [newQuantity, setNewQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const productList = (products.data as any)?.data ?? [];
  const knownLocations = useMemo(() => [...new Set([...(((balances.data as any)?.data ?? []).map((b: any) => b.locationId ?? b.location).filter(Boolean)), "main"])], [balances.data]);

  if (list.isLoading || products.isLoading || balances.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Inventory adjustments unavailable" description="Unable to load adjustments." />;

  async function submit() {
    setError(null); setOkMsg(null);
    if (!productId) { setError("Pilih produk."); return; }
    if (!location.trim()) { setError("Isi lokasi gudang."); return; }
    if (newQuantity === "" || Number(newQuantity) < 0) { setError("Isi kuantitas baru (>= 0)."); return; }
    if (description.trim().length < 2) { setError("Isi deskripsi adjustment."); return; }
    try {
      await mutation.mutateAsync({ productId, locationId: location.trim(), movementDate, newQuantity, description: description.trim() });
      setOkMsg("Adjustment tersimpan."); setProductId(""); setNewQuantity(""); setDescription("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan adjustment."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((m: any) => ({ product: m.productId, date: String(m.movementDate).slice(0, 10), quantity: String(m.quantity ?? ""), cost: String(m.unitCost ?? ""), journal: m.postedJournalId ?? "-" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Inventory" title="Inventory Adjustments" description="Adjust stock quantities for a product at a specific location. Posts an adjustment journal entry." /><SplitWorkspace main={<GlassTable columns={[{ key: "product", header: "Product" }, { key: "date", header: "Date" }, { key: "quantity", header: "Quantity" }, { key: "cost", header: "Cost" }, { key: "journal", header: "Journal" }]} rows={rows} empty="No inventory adjustments loaded" />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Product</span><GlassDataSelect value={productId} onChange={setProductId} placeholder={productList.length ? "Pilih produk" : "Belum ada produk"} options={productList.map((p: any) => ({ value: p.id, label: `${p.sku} ${p.name}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Location (gudang)</span><GlassInput value={location} onChange={(e) => setLocation(e.target.value)} className="h-10" placeholder="main" /></label><label className="grid gap-1"><span className="text-xs text-muted">Movement date</span><GlassInput value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">New quantity</span><GlassInput value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="h-10" placeholder="0" /></label><label className="grid gap-1"><span className="text-xs text-muted">Description</span><GlassInput value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" placeholder="Stock opname koreksi" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Create adjustment</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Traceability">Adjustment rows open product, cost history, and journal source drawers.</DetailPanel></>} /></div>;
}
