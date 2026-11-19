"use client";

import { LazyActivityBarChart } from "@/components/charts/lazy-charts";
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
  return useQuery({ queryKey: ["dashboard", "float"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Data analitik belum bisa dimuat" description="Coba muat ulang halaman." />;
  const overview = data.data;
  // lowFloatProviders hanya berisi rekanan yang saldonya di bawah batas — bukan semua rekanan.
  const trend = overview.float?.lowFloatProviders?.map((p: any) => ({ label: p.provider, value: Number(p.balance) })) ?? [];
  return (
    <DashboardGrid>
      <section className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Analitik</p>
          <h1 className="mt-2 text-3xl font-semibold">Analitik Saldo Rekanan</h1>
          <p className="mt-2 text-sm text-muted">Total saldo di rekanan, pemakaian hari ini, dan rekanan yang saldonya perlu segera diisi.</p>
        </div>
        <RealtimeStatus />
      </section>
      <KpiGrid
        items={[
          { title: "Total saldo rekanan", value: formatRupiah(overview.float?.totalFloatBalance ?? 0), detail: "Saldo di semua rekanan" },
          { title: "Pemakaian saldo hari ini", value: formatRupiah(overview.float?.floatUsageToday ?? 0), detail: "Saldo rekanan terpakai hari ini" },
          { title: "Rekanan bersaldo rendah", value: formatNumber(overview.float?.lowFloatProviders?.length ?? 0), detail: "Rekanan di bawah batas minimum" },
          { title: "Uang kas", value: formatRupiah(overview.cash?.cashOnHand ?? 0), detail: "Total saldo rekening kas" },
        ]}
      />
      <LazyActivityBarChart data={trend} title="Saldo rekanan yang menipis" valueFormat="money" seriesLabel="Saldo" emptyMessage="Tidak ada rekanan dengan saldo rendah." />
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
