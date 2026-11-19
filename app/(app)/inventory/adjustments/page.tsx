"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";
import { formatNumber, formatRupiah } from "@/presentation/format/number";

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
  if (list.error) return <GlassErrorState title="Penyesuaian stok belum bisa dimuat" description="Coba muat ulang halaman." />;

  async function submit() {
    setError(null); setOkMsg(null);
    if (!productId) { setError("Pilih produk."); return; }
    if (!location.trim()) { setError("Isi lokasi gudang."); return; }
    if (newQuantity === "" || Number(newQuantity) < 0) { setError("Isi kuantitas baru (>= 0)."); return; }
    if (description.trim().length < 2) { setError("Isi keterangan penyesuaian."); return; }
    try {
      await mutation.mutateAsync({ productId, locationId: location.trim(), movementDate, newQuantity, description: description.trim() });
      setOkMsg("Penyesuaian stok tersimpan."); setProductId(""); setNewQuantity(""); setDescription("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan penyesuaian stok."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((m: any) => ({ product: m.productId, date: String(m.movementDate).slice(0, 10), quantity: formatNumber(m.quantity), cost: formatRupiah(m.unitCost), journal: m.postedJournalId ?? "-" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Persediaan" title="Penyesuaian Stok" description="Koreksi jumlah stok produk di gudang tertentu, misalnya setelah stok opname." /><SplitWorkspace main={<GlassTable columns={[{ key: "product", header: "Produk" }, { key: "date", header: "Tanggal" }, { key: "quantity", header: "Kuantitas" }, { key: "cost", header: "Biaya per unit" }, { key: "journal", header: "Jurnal" }]} rows={rows} empty="Belum ada penyesuaian stok. Isi formulir di samping untuk mencatatnya." />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Produk</span><GlassDataSelect value={productId} onChange={setProductId} placeholder={productList.length ? "Pilih produk" : "Belum ada produk"} options={productList.map((p: any) => ({ value: p.id, label: `${p.sku} ${p.name}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Lokasi gudang</span><GlassInput value={location} onChange={(e) => setLocation(e.target.value)} className="h-10" placeholder="main" /></label><label className="grid gap-1"><span className="text-xs text-muted">Tanggal</span><GlassInput value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Jumlah stok baru</span><GlassInput value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="h-10" placeholder="0" /></label><label className="grid gap-1"><span className="text-xs text-muted">Keterangan</span><GlassInput value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" placeholder="Stock opname koreksi" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan penyesuaian</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Penelusuran">Setiap baris bisa ditelusuri ke produk, riwayat biaya, dan jurnal asalnya.</DetailPanel></>} /></div>;
}
