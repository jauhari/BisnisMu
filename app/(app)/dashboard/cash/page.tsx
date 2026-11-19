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
  return useQuery({ queryKey: ["dashboard", "cash"], queryFn: () => apiRequest<{ data: any }>("/api/dashboard/overview", { method: "POST", body: JSON.stringify({ startsOn, endsOn }) }) });
}

export default function Page() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Data analitik belum bisa dimuat" description="Coba muat ulang halaman." />;
  const overview = data.data;
  const trend = [{ label: "Kas", value: Number(overview.cash?.cashOnHand ?? 0) }, { label: "Bank", value: Number(overview.cash?.bankBalance ?? 0) }, { label: "Arus hari ini", value: Number(overview.cash?.cashFlowToday ?? 0) }];
  const accountRows = (overview.cash?.accounts ?? []).map((account: any) => ({
    account: `${account.code} | ${account.name}`,
    type: account.subtype === "bank" ? "Bank" : "Kas",
    balance: formatRupiah(account.balance),
    status: account.balance < 0 ? "Saldo negatif" : account.balance === 0 ? "Belum ada saldo" : "Saldo tersedia",
  }));
  return <DashboardGrid><section className="flex items-end justify-between"><div><p className="text-sm font-medium text-accent">Analitik</p><h1 className="mt-2 text-3xl font-semibold">Analitik Kas</h1><p className="mt-2 text-sm text-muted">Posisi kas dan bank berdasarkan jurnal yang sudah diposting.</p></div><RealtimeStatus /></section><KpiGrid items={[{ title: "Uang kas", value: formatRupiah(overview.cash?.cashOnHand ?? 0), detail: "Total saldo rekening kas" }, { title: "Saldo bank", value: formatRupiah(overview.cash?.bankBalance ?? 0), detail: "Total saldo rekening bank" }, { title: "Arus kas hari ini", value: formatRupiah(overview.cash?.cashFlowToday ?? 0), detail: "Pergerakan bersih hari ini" }, { title: "Total saldo rekanan", value: formatRupiah(overview.float?.totalFloatBalance ?? 0), detail: "Saldo di semua rekanan" }]} /><section className="grid gap-6 xl:grid-cols-2"><LazyRevenueTrendChart data={trend} title="Posisi kas" valueFormat="money" seriesLabel="Jumlah" emptyMessage="Belum ada saldo kas atau bank." /><LazyActivityBarChart data={trend} title="Saldo" valueFormat="money" seriesLabel="Jumlah" emptyMessage="Belum ada saldo kas atau bank." /></section><section className="grid gap-3"><div><h2 className="text-lg font-semibold">Saldo tiap rekening</h2><p className="mt-1 text-sm text-muted">Rincian saldo bersih per rekening kas dan bank. Saldo dihitung dari debit dikurangi kredit.</p></div><GlassTable selectable={false} tableId="cash-account-balances" columns={[{ key: "account", header: "Rekening" }, { key: "type", header: "Jenis" }, { key: "balance", header: "Saldo" }, { key: "status", header: "Status" }]} rows={accountRows} empty="Belum ada rekening kas atau bank." /></section><GlassTable selectable={false} tableId="cash-analytics-summary" columns={[{ key: "metric", header: "Ringkasan" }, { key: "value", header: "Nilai" }, { key: "detail", header: "Keterangan" }]} rows={[{ metric: "Piutang", value: formatRupiah(overview.receivable?.totalReceivable ?? 0), detail: "Tagihan pelanggan yang belum dibayar" }, { metric: "Utang", value: formatRupiah(overview.payable?.totalPayable ?? 0), detail: "Tagihan pemasok yang belum dibayar" }, { metric: "Laba bersih", value: formatRupiah(overview.profitability?.netProfit ?? 0), detail: "Periode berjalan" }]} /></DashboardGrid>;
}
