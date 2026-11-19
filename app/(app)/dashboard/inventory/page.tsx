"use client";

import { LazyActivityBarChart, LazyRevenueTrendChart } from "@/components/charts/lazy-charts";
import { DashboardGrid, KpiGrid, RealtimeStatus } from "@/components/charts/dashboard-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { formatNumber, formatRupiah } from "@/presentation/format/number";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/presentation/api/client";

function useDashboard() {
  const now = new Date();
  const startsOn = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endsOn = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return useQuery({ queryKey: ["dashboard", "inventory"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Data analitik belum bisa dimuat" description="Coba muat ulang halaman." />;
  const overview = data.data;
  // fastMovingItems berisi jumlah unit keluar (bukan Rupiah), jadi chart memakai format angka.
  const trend = overview.inventory?.fastMovingItems?.map((p: any) => ({ label: p.name?.slice(0, 8) ?? p.id, value: Number(p.quantity ?? p.amount) })) ?? [];
  return (
    <DashboardGrid>
      <section className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Analitik</p>
          <h1 className="mt-2 text-3xl font-semibold">Analitik Stok</h1>
          <p className="mt-2 text-sm text-muted">Nilai persediaan, barang yang stoknya menipis, dan barang yang paling banyak keluar.</p>
        </div>
        <RealtimeStatus />
      </section>
      <KpiGrid
        items={[
          { title: "Nilai stok", value: formatRupiah(overview.inventory?.inventoryValue ?? 0), detail: "Total nilai persediaan" },
          { title: "Stok menipis", value: formatNumber(overview.inventory?.lowStockItems?.length ?? 0), detail: "Barang di bawah batas minimum" },
          { title: "Uang kas", value: formatRupiah(overview.cash?.cashOnHand ?? 0), detail: "Total saldo rekening kas" },
          { title: "Total saldo rekanan", value: formatRupiah(overview.float?.totalFloatBalance ?? 0), detail: "Saldo di semua rekanan" },
        ]}
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <LazyRevenueTrendChart data={trend} title="Barang paling laku" valueFormat="number" seriesLabel="Unit keluar" emptyMessage="Belum ada barang keluar pada periode ini." />
        <LazyActivityBarChart data={trend} title="Jumlah unit keluar" valueFormat="number" seriesLabel="Unit keluar" emptyMessage="Belum ada barang keluar pada periode ini." />
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
