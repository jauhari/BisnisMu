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
  return useQuery({ queryKey: ["dashboard", "customers"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Data analitik belum bisa dimuat" description="Coba muat ulang halaman." />;
  const overview = data.data;
  const trend = overview.customer?.topCustomers?.map((c: any) => ({ label: c.name?.slice(0, 8) ?? c.id, value: Number(c.amount) })) ?? [];
  return (
    <DashboardGrid>
      <section className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Analitik</p>
          <h1 className="mt-2 text-3xl font-semibold">Analitik Pelanggan</h1>
          <p className="mt-2 text-sm text-muted">Jumlah pelanggan aktif, saldo deposit, piutang, dan pelanggan dengan tagihan terbesar.</p>
        </div>
        <RealtimeStatus />
      </section>
      <KpiGrid
        items={[
          { title: "Pelanggan aktif", value: formatNumber(overview.customer?.activeCustomers ?? 0), detail: "Pelanggan berstatus aktif" },
          { title: "Saldo deposit pelanggan", value: formatRupiah(overview.customer?.customerDepositBalance ?? 0), detail: "Uang titipan pelanggan" },
          { title: "Piutang", value: formatRupiah(overview.receivable?.totalReceivable ?? 0), detail: "Tagihan pelanggan yang belum dibayar" },
          { title: "Lewat jatuh tempo", value: formatRupiah(overview.receivable?.overdueReceivable ?? 0), detail: "Piutang yang sudah lewat jatuh tempo" },
        ]}
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <LazyRevenueTrendChart data={trend} title="Pelanggan teratas" valueFormat="money" seriesLabel="Nilai tagihan" emptyMessage="Belum ada tagihan pelanggan pada periode ini." />
        <LazyActivityBarChart data={trend} title="Nilai tagihan per pelanggan" valueFormat="money" seriesLabel="Nilai tagihan" emptyMessage="Belum ada tagihan pelanggan pada periode ini." />
      </section>
      <GlassTable
        columns={[{ key: "metric", header: "Ringkasan" }, { key: "value", header: "Nilai" }, { key: "detail", header: "Keterangan" }]}
        rows={[
          { metric: "Laba bersih", value: formatRupiah(overview.profitability?.netProfit ?? 0), detail: "Periode berjalan" },
          { metric: "Utang", value: formatRupiah(overview.payable?.totalPayable ?? 0), detail: "Tagihan pemasok yang belum dibayar" },
          { metric: "Nilai stok", value: formatRupiah(overview.inventory?.inventoryValue ?? 0), detail: "Total nilai persediaan" },
        ]}
      />
    </DashboardGrid>
  );
}
