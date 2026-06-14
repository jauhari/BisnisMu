"use client";

import { RevenueTrendChart } from "@/components/charts/financial-charts";
import { ReportWorkspace } from "@/components/charts/report-layout";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useProfitLossReport } from "@/presentation/query/dashboard-hooks";
import { useActiveBusiness, useReportRange, buildRequest } from "@/presentation/query/report-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { exportProfitLossPdf, exportProfitLossExcel } from "@/presentation/export/report-exports";

const n = (v: any) => Number(v ?? 0);

function pct(part: number, total: number): string {
  if (total === 0) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export default function Page() {
  const { data: biz, isLoading: bizLoading } = useActiveBusiness();
  const { startsOn, endsOn, setStartsOn, setEndsOn, activePreset, setActivePreset } = useReportRange();
  const { data, isLoading, error } = useProfitLossReport(
    biz ? buildRequest(biz.id, startsOn, endsOn) : buildRequest("__placeholder__", startsOn, endsOn)
  );

  if (bizLoading || isLoading) return <GlassSkeleton className="h-72" />;
  if (!biz || error || !data) return <GlassErrorState title="Laba Rugi tidak tersedia" description="Tidak dapat memuat laporan laba rugi." />;

  const report = data.data;
  const revenue = n(report.revenue?.total);
  const cogs = n(report.cogs?.total);
  const expenses = n(report.expenses?.total);
  const otherExpenses = n(report.otherExpenses?.total);
  const grossProfit = n(report.grossProfit);
  const netIncome = n(report.netIncome);
  const isLoss = netIncome < 0;

  const trend = [
    { label: "Pendapatan", value: revenue },
    { label: "HPP", value: cogs },
    { label: "Beban", value: expenses },
    { label: "Laba Bersih", value: netIncome },
  ];

  const rows = [
    { section: "PENDAPATAN", amount: "", margin: "" },
    ...(report.revenue?.lines ?? []).map((l: any) => ({
      section: `  ${l.accountName}`,
      amount: formatRupiah(n(l.amount)),
      margin: "",
    })),
    { section: "Total Pendapatan", amount: formatRupiah(revenue), margin: "100%" },
    { section: "", amount: "", margin: "" },
    ...(cogs > 0 ? [
      { section: "HARGA POKOK PENJUALAN", amount: "", margin: "" },
      ...(report.cogs?.lines ?? []).map((l: any) => ({
        section: `  ${l.accountName}`,
        amount: formatRupiah(n(l.amount)),
        margin: "",
      })),
      { section: "Total HPP", amount: formatRupiah(cogs), margin: pct(cogs, revenue) },
      { section: "LABA KOTOR", amount: formatRupiah(grossProfit), margin: pct(grossProfit, revenue) },
      { section: "", amount: "", margin: "" },
    ] : []),
    { section: "BEBAN OPERASIONAL", amount: "", margin: "" },
    ...(report.expenses?.lines ?? []).map((l: any) => ({
      section: `  ${l.accountName}`,
      amount: formatRupiah(n(l.amount)),
      margin: "",
    })),
    ...(expenses > 0 ? [{ section: "Total Beban Operasional", amount: formatRupiah(expenses), margin: pct(expenses, revenue) }] : []),
    ...(otherExpenses > 0 ? [
      { section: "BEBAN LAIN-LAIN", amount: "", margin: "" },
      ...(report.otherExpenses?.lines ?? []).map((l: any) => ({
        section: `  ${l.accountName}`,
        amount: formatRupiah(n(l.amount)),
        margin: "",
      })),
      { section: "Total Beban Lain", amount: formatRupiah(otherExpenses), margin: pct(otherExpenses, revenue) },
    ] : []),
    { section: "", amount: "", margin: "" },
    { section: "LABA BERSIH", amount: formatRupiah(netIncome), margin: pct(netIncome, revenue) },
  ];

  return (
    <ReportWorkspace
      title="Laba Rugi"
      startsOn={startsOn} endsOn={endsOn}
      onStartsOnChange={setStartsOn} onEndsOnChange={setEndsOn} activePreset={activePreset} onPresetChange={setActivePreset}
      onExportPdf={() => exportProfitLossPdf(report, biz.name, startsOn, endsOn)}
      onExportExcel={() => exportProfitLossExcel(report, biz.name, startsOn, endsOn)}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <GlassStatsCard title="Pendapatan" value={formatRupiah(revenue)} detail="Total periode ini" />
        <GlassStatsCard title="Laba Kotor" value={formatRupiah(grossProfit)} detail={`Margin ${pct(grossProfit, revenue)}`} />
        <GlassStatsCard
          title="Laba Bersih"
          value={`${isLoss ? "▼ Rugi " : netIncome > 0 ? "▲ Laba " : ""}${formatRupiah(netIncome)}`}
          detail={`Margin ${pct(netIncome, revenue)}`}
          className={isLoss ? "border-danger/30 bg-danger/5" : netIncome > 0 ? "border-success/30 bg-success/5" : ""}
        />
        <GlassStatsCard title="Total Beban" value={formatRupiah(cogs + expenses + otherExpenses)} detail={`${pct(cogs + expenses + otherExpenses, revenue)} dari pendapatan`} />
      </section>

      {isLoss && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          ⚠ Periode ini usaha mengalami <strong>kerugian {formatRupiah(Math.abs(netIncome))}</strong>. Periksa beban operasional Anda.
        </div>
      )}

      <RevenueTrendChart data={trend} title="Komponen laba rugi" />

      <GlassTable
        tableId="report-profit-loss"
        columns={[
          { key: "section", header: "Keterangan" },
          { key: "amount", header: "Jumlah (Rp)" },
          { key: "margin", header: "% Pendapatan" },
        ]}
        rows={rows}
        empty="Tidak ada data laba rugi."
      />
    </ReportWorkspace>
  );
}
