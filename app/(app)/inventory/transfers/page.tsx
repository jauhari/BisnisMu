"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";
import { formatNumber } from "@/presentation/format/number";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Page() {
  const mutation = usePostMutation("/api/inventory/transfers");
  const list = useListQuery<any[]>("/api/inventory/transfers", ["list", "inventory-transfers"]);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const balances = useListQuery<any[]>("/api/inventory/balances", ["list", "inventory-balances"]);

  const [productId, setProductId] = useState("");
  const [fromLocation, setFromLocation] = useState("main");
  const [toLocation, setToLocation] = useState("");
  const [movementDate, setMovementDate] = useState(() => todayIso());
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const productList = (products.data as any)?.data ?? [];
  const knownLocations = useMemo(() => [...new Set([...(((balances.data as any)?.data ?? []).map((b: any) => b.locationId ?? b.location).filter(Boolean)), "main"])], [balances.data]);

  if (list.isLoading || products.isLoading || balances.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Transfer stok belum bisa dimuat" description="Coba muat ulang halaman." />;

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

  const rows = ((list.data as any)?.data ?? []).map((m: any) => ({ product: m.productId, date: String(m.movementDate).slice(0, 10), quantity: formatNumber(m.quantity), from: m.fromWarehouseId ?? "-", to: m.toWarehouseId ?? "-" }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Persediaan" title="Transfer Stok" description="Pindahkan stok produk dari satu gudang ke gudang lain." /><SplitWorkspace main={<GlassTable columns={[{ key: "product", header: "Produk" }, { key: "date", header: "Tanggal" }, { key: "quantity", header: "Kuantitas" }, { key: "from", header: "Dari" }, { key: "to", header: "Ke" }]} rows={rows} empty="Belum ada transfer stok. Isi formulir di samping untuk memindahkan stok." />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Produk</span><GlassDataSelect value={productId} onChange={setProductId} placeholder={productList.length ? "Pilih produk" : "Belum ada produk"} options={productList.map((p: any) => ({ value: p.id, label: `${p.sku} ${p.name}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Gudang asal</span><GlassInput value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} className="h-10" placeholder="main" /></label><label className="grid gap-1"><span className="text-xs text-muted">Gudang tujuan</span><GlassInput value={toLocation} onChange={(e) => setToLocation(e.target.value)} className="h-10" placeholder="warehouse-2" /></label><label className="grid gap-1"><span className="text-xs text-muted">Tanggal</span><GlassInput value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Kuantitas</span><GlassInput value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10" placeholder="0" /></label><label className="grid gap-1"><span className="text-xs text-muted">Keterangan</span><GlassInput value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" placeholder="Pindah stok ke gudang 2" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan transfer</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Penelusuran">Setiap baris bisa ditelusuri ke produk, riwayat biaya, dan jurnal asalnya.</DetailPanel></>} /></div>;
}
