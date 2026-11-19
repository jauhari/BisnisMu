"use client";

import Link from "next/link";
import { ActivityBarChart, RevenueTrendChart, type TrendPoint } from "@/components/charts/financial-charts";

const ctaClass =
  "rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent/15";

export function DashboardCharts({
  salesTrend,
  cashTrend,
  periodLabel,
}: {
  salesTrend: TrendPoint[];
  cashTrend: TrendPoint[];
  periodLabel: string;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <RevenueTrendChart
        data={salesTrend}
        title="Tren penjualan"
        valueFormat="money"
        seriesLabel="Penjualan"
        emptyMessage={`Belum ada penjualan dalam ${periodLabel} terakhir.`}
        emptyAction={<Link href="/sales/orders" className={ctaClass}>Catat penjualan</Link>}
      />
      <ActivityBarChart
        data={cashTrend}
        title="Arus kas bersih"
        valueFormat="money"
        seriesLabel="Kas masuk − keluar"
        emptyMessage={`Belum ada kas masuk atau keluar dalam ${periodLabel} terakhir.`}
        emptyAction={<Link href="/cash/transactions" className={ctaClass}>Catat transaksi kas</Link>}
      />
    </section>
  );
}
