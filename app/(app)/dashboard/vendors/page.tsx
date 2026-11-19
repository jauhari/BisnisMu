"use client";

import { LazyActivityBarChart, LazyRevenueTrendChart } from "@/components/charts/lazy-charts";
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
  return useQuery({ queryKey: ["dashboard", "vendors"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Data analitik belum bisa dimuat" description="Coba muat ulang halaman." />;
  const overview = data.data;
  const trend = overview.vendor?.topVendors?.map((v: any) => ({ label: v.name?.slice(0, 8) ?? v.id, value: Number(v.amount) })) ?? [];
  return (
    <DashboardGrid>
      <section className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Analitik</p>
          <h1 className="mt-2 text-3xl font-semibold">Analitik Pemasok</h1>
          <p className="mt-2 text-sm text-muted">Utang ke pemasok, tagihan yang lewat jatuh tempo, dan pemasok dengan belanja terbesar.</p>
        </div>
        <RealtimeStatus />
      </section>
      <KpiGrid
        items={[
          { title: "Utang", value: formatRupiah(overview.payable?.totalPayable ?? 0), detail: "Tagihan pemasok yang belum dibayar" },
          { title: "Lewat jatuh tempo", value: formatRupiah(overview.payable?.overduePayable ?? 0), detail: "Utang yang sudah lewat jatuh tempo" },
          { title: "Sisa tagihan pemasok", value: formatRupiah(overview.vendor?.vendorOutstandingBalance ?? 0), detail: "Total sisa tagihan semua pemasok" },
          { title: "Uang kas", value: formatRupiah(overview.cash?.cashOnHand ?? 0), detail: "Total saldo rekening kas" },
        ]}
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <LazyRevenueTrendChart data={trend} title="Pemasok teratas" valueFormat="money" seriesLabel="Belanja" emptyMessage="Belum ada tagihan pemasok pada periode ini." />
        <LazyActivityBarChart data={trend} title="Belanja per pemasok" valueFormat="money" seriesLabel="Belanja" emptyMessage="Belum ada tagihan pemasok pada periode ini." />
      </section>
      <GlassTable
        columns={[{ key: "metric", header: "Ringkasan" }, { key: "value", header: "Nilai" }, { key: "detail", header: "Keterangan" }]}
        rows={[
          { metric: "Laba bersih", value: formatRupiah(overview.profitability?.netProfit ?? 0), detail: "Periode berjalan" },
          { metric: "Piutang", value: formatRupiah(overview.receivable?.totalReceivable ?? 0), detail: "Tagihan pelanggan yang belum dibayar" },
          { metric: "Nilai stok", value: formatRupiah(overview.inventory?.inventoryValue ?? 0), detail: "Total nilai persediaan" },
        ]}
      />
    </DashboardGrid>
  );
}
