import { Suspense } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardGrid, DashboardExceptionPanel, KpiGrid } from "@/components/charts/dashboard-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { formatMoney, formatNumber, formatPercent } from "@/presentation/format/number";
import { getAuthenticatedUserContextByToken, getServerSessionToken } from "@/presentation/auth/session";
import { getCachedDashboardSummary } from "@/presentation/dashboard/dashboard-summary";

const DashboardCharts = dynamic(
  () => import("./dashboard-charts").then((module) => module.DashboardCharts),
  {
    loading: () => <div className="grid gap-6 xl:grid-cols-2"><GlassSkeleton className="h-72" /><GlassSkeleton className="h-72" /></div>,
  },
);

type FilterOption = "1w" | "1m" | "3m" | "6m" | "1y";

const FILTER_BUTTON_LABELS: Record<FilterOption, string> = {
  "1w": "1 Minggu",
  "1m": "1 Bulan",
  "3m": "3 Bulan",
  "6m": "6 Bulan",
  "1y": "1 Tahun",
};

// Dipakai di kalimat ("… dalam 1 bulan terakhir").
const PERIOD_LABELS: Record<FilterOption, string> = {
  "1w": "1 minggu",
  "1m": "1 bulan",
  "3m": "3 bulan",
  "6m": "6 bulan",
  "1y": "1 tahun",
};

function getDateRange(filter: FilterOption = "1m") {
  const endsOn = new Date();
  endsOn.setHours(23, 59, 59, 999);
  const startsOn = new Date();
  startsOn.setHours(0, 0, 0, 0);

  if (filter === "1w") startsOn.setDate(endsOn.getDate() - 7);
  else if (filter === "1m") startsOn.setMonth(endsOn.getMonth() - 1);
  else if (filter === "3m") startsOn.setMonth(endsOn.getMonth() - 3);
  else if (filter === "6m") startsOn.setMonth(endsOn.getMonth() - 6);
  else if (filter === "1y") startsOn.setFullYear(endsOn.getFullYear() - 1);

  return { startsOn: startsOn.toISOString(), endsOn: endsOn.toISOString() };
}

async function DashboardContent({ filter }: { filter: FilterOption }) {
  const token = await getServerSessionToken();
  if (!token) notFound();

  const context = await getAuthenticatedUserContextByToken(token);
  const { startsOn, endsOn } = getDateRange(filter);

  const summary = await getCachedDashboardSummary({
    businessId: context.businessId,
    startsOn: new Date(startsOn),
    endsOn: new Date(endsOn),
  });

  const salesTrend = summary.salesTrend;
  const cashTrend = summary.cashTrend;

  const periodLabel = PERIOD_LABELS[filter];
  const lowStockCount = summary.lowStockCount;
  const attentionItems: Array<{ label: string; value: string; href: string; action: string; ok: boolean }> = [
    {
      label: "Piutang lewat jatuh tempo",
      value: formatMoney(BigInt(summary.overdueReceivable)),
      href: "/ar-ap/receivables",
      action: "Cek piutang",
      ok: BigInt(summary.overdueReceivable) === 0n,
    },
    {
      label: "Barang stok menipis",
      value: `${formatNumber(lowStockCount)} barang`,
      href: "/inventory/balances",
      action: "Cek stok",
      ok: lowStockCount === 0,
    },
    {
      label: "Saldo rekanan menipis",
      value: summary.lowFloatProvider ?? "Tidak ada",
      href: "/float/top-up",
      action: "Isi saldo",
      ok: !summary.lowFloatProvider,
    },
  ];

  return (
    <DashboardGrid>
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold">Ringkasan usaha</h1>
          <p className="mt-2 text-sm text-muted">Penjualan, laba, kas, dan stok usaha Anda dalam {periodLabel} terakhir.</p>
        </div>
        <nav aria-label="Pilih periode" className="flex shrink-0 overflow-x-auto rounded-lg border border-border/40 bg-white/50 p-1 backdrop-blur-sm dark:bg-white/5">
          {(["1w", "1m", "3m", "6m", "1y"] as const).map((opt) => {
            const active = filter === opt;
            const search = new URLSearchParams({ filter: opt });
            return (
              <a
                key={opt}
                href={`?${search}`}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active ? "bg-accent text-background shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                {FILTER_BUTTON_LABELS[opt]}
              </a>
            );
          })}
        </nav>
      </section>

      <KpiGrid items={[
        { title: "Penjualan hari ini", value: formatMoney(BigInt(summary.salesToday)), detail: "Total penjualan tercatat hari ini" },
        { title: "Laba bersih", value: formatMoney(BigInt(summary.netProfit)), detail: `Marjin ${formatPercent(summary.profitMargin)} · ${periodLabel} terakhir` },
        { title: "Saldo kas & bank", value: formatMoney(BigInt(summary.cashOnHand) + BigInt(summary.bankBalance)), detail: `Kas ${formatMoney(BigInt(summary.cashOnHand))} · Bank ${formatMoney(BigInt(summary.bankBalance))}` },
        { title: "Nilai persediaan", value: formatMoney(BigInt(summary.inventoryValue)), detail: lowStockCount > 0 ? `${formatNumber(lowStockCount)} barang stok menipis` : "Semua stok aman" }
      ]} />

      <DashboardCharts salesTrend={salesTrend} cashTrend={cashTrend} periodLabel={periodLabel} />

      <DashboardExceptionPanel>
        <ul className="divide-y divide-border/60">
          {attentionItems.map((item) => (
            <li key={item.label} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.ok ? "bg-success" : "bg-warning"}`}
                />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-sm text-muted tabular-nums">{item.value}</p>
                </div>
              </div>
              <Link
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent/10"
              >
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      </DashboardExceptionPanel>
    </DashboardGrid>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams;
  const filter = (["1w", "1m", "3m", "6m", "1y"] as const).includes(params.filter as any) ? (params.filter as any) : "1m";

  return (
    <Suspense fallback={<div className="grid gap-4"><GlassSkeleton className="h-28" /><GlassSkeleton className="h-72" /></div>}>
      <DashboardContent filter={filter} />
    </Suspense>
  );
}

