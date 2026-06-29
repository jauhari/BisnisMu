"use client";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { formatRupiah, formatNumber } from "@/presentation/format/number";
export default function Page() {
  const { data, isLoading, error } = useListQuery<any[]>("/api/inventory/balances", ["list", "inventory-balances"]);
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Inventory balances unavailable" description="Unable to load stock balances." />;
  const rows = data.data;
  const inventoryValue = rows.reduce((sum: number, row: any) => sum + Number(row.value ?? 0), 0);
  const totalQty = rows.reduce((sum: number, row: any) => sum + Number(row.quantity ?? 0), 0);
  const locations = new Set(rows.map((row: any) => row.location)).size;
  const adjustLink = <Link href="/inventory/adjustments" className="inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-background">Sesuaikan stok</Link>;
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Inventory" title="Saldo Stok" description="Kuantitas, biaya rata-rata, dan nilai persediaan per produk." action={adjustLink} /><section className="grid gap-4 md:grid-cols-3"><GlassStatsCard title="Nilai persediaan" value={formatRupiah(inventoryValue)} detail="Basis biaya rata-rata" /><GlassStatsCard title="Total kuantitas" value={formatNumber(totalQty)} detail="Unit tersedia" /><GlassStatsCard title="Lokasi" value={String(locations)} detail="Gudang" /></section><GlassTable tableId="inventory-balances" columns={[{ key: "product", header: "Produk" }, { key: "location", header: "Lokasi" }, { key: "quantity", header: "Kuantitas" }, { key: "averageCost", header: "Biaya rata-rata" }, { key: "value", header: "Nilai" }]} rows={rows} empty="Belum ada saldo stok." /></div>;
}
