"use client";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { formatRupiah } from "@/presentation/format/number";
const money = (v: unknown) => (v === null || v === undefined || v === "" ? v : formatRupiah(v as string));
export default function Page() { const { data, isLoading, error } = useListQuery<any[]>("/api/pos/receipts", ["list", "pos-receipts"]); if (isLoading) return <GlassSkeleton className="h-72" />; if (error || !data) return <GlassErrorState title="Struk belum bisa dimuat" description="Coba muat ulang halaman." />; return <div className="grid gap-6"><WorkspaceHeader eyebrow="Kasir" title="Struk" description="Cari dan lihat kembali struk dari transaksi kasir yang sudah selesai." /><GlassTable columns={[{ key: "receipt", header: "No. struk" }, { key: "transaction", header: "Transaksi" }, { key: "issued", header: "Dicetak" }, { key: "paid", header: "Dibayar" }, { key: "change", header: "Kembalian" }]} rows={(data.data ?? []).map((r: any) => ({ ...r, paid: money(r.paid), change: money(r.change) }))} empty="Belum ada struk. Struk muncul setelah ada transaksi di halaman Kasir." /></div>; }
