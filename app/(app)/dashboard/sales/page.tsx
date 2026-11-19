"use client";

import { LazyActivityBarChart } from "@/components/charts/lazy-charts";
import { DashboardGrid, KpiGrid, RealtimeStatus } from "@/components/charts/dashboard-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { formatRupiah } from "@/presentation/format/number";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/presentation/api/client";

function useDashboard() {
  const now = new Date();
  const startsOn = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endsOn = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return useQuery({ queryKey: ["dashboard", "sales"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Data analitik belum bisa dimuat" description="Coba muat ulang halaman." />;
  const overview = data.data;
  const products = overview.sales?.topProducts?.map((p: any) => ({ label: p.name?.slice(0, 8) ?? p.id, value: Number(p.amount) })) ?? [];
  // Engine memberi nama "Uncategorized" untuk produk tanpa kategori — tampilkan dalam bahasa Indonesia.
  const categories = overview.sales?.topCategories?.map((c: any) => ({ label: c.id === "uncategorized" ? "Tanpa kategori" : c.name?.slice(0, 12) ?? c.id, value: Number(c.amount) })) ?? [];
  return (
    <DashboardGrid>
      <section className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Analitik</p>
          <h1 className="mt-2 text-3xl font-semibold">Analitik Penjualan</h1>
          <p className="mt-2 text-sm text-muted">Ringkasan penjualan bulan ini, produk dan kategori terlaris, serta posisi keuangan usaha.</p>
        </div>
        <RealtimeStatus />
      </section>
      <KpiGrid
        items={[
          { title: "Penjualan bulan ini", value: formatRupiah(overview.sales?.salesThisMonth ?? 0), detail: "Total penjualan sejak awal bulan" },
          { title: "Uang kas", value: formatRupiah(overview.cash?.cashOnHand ?? 0), detail: "Total saldo rekening kas" },
          { title: "Nilai stok", value: formatRupiah(overview.inventory?.inventoryValue ?? 0), detail: "Total nilai persediaan" },
          { title: "Total saldo rekanan", value: formatRupiah(overview.float?.totalFloatBalance ?? 0), detail: "Saldo di semua rekanan" },
        ]}
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <LazyActivityBarChart data={products} title="Produk terlaris" valueFormat="money" seriesLabel="Penjualan" emptyMessage="Belum ada penjualan pada periode ini." />
        <LazyActivityBarChart data={categories} title="Penjualan per kategori" valueFormat="money" seriesLabel="Penjualan" emptyMessage="Belum ada penjualan pada periode ini." />
      </section>
      <GlassTable
        columns={[{ key: "metric", header: "Ringkasan" }, { key: "value", header: "Nilai" }, { key: "detail", header: "Keterangan" }]}
        rows={[
          { metric: "Piutang", value: formatRupiah(overview.receivable?.totalReceivable ?? 0), detail: "Tagihan pelanggan yang belum dibayar" },
          { metric: "Utang", value: formatRupiah(overview.payable?.totalPayable ?? 0), detail: "Tagihan pemasok yang belum dibayar" },
          { metric: "Laba bersih", value: formatRupiah(overview.profitability?.netProfit ?? 0), detail: "Periode berjalan" },
        ]}
      />
    </DashboardGrid>
  );
}
