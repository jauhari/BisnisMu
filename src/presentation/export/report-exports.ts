"use client";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(amount: number | string | bigint | undefined | null): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function periodLabel(startsOn?: Date, endsOn?: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" };
  const f = (d?: Date) => d ? new Intl.DateTimeFormat("id-ID", opts).format(d) : "—";
  return `${f(startsOn)} – ${f(endsOn)}`;
}

function pdfHeader(doc: import("jspdf").jsPDF, title: string, bizName: string, period: string) {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 105, 18, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(bizName, 105, 25, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Periode: ${period}`, 105, 31, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Dicetak: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())}`, 105, 37, { align: "center" });
  doc.setTextColor(0);
}

// ─── PDF ────────────────────────────────────────────────────────────────────

export async function exportProfitLossPdf(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  pdfHeader(doc, "Laporan Laba Rugi", bizName, periodLabel(startsOn, endsOn));

  const rows: (string | number)[][] = [];
  (report.revenue?.lines ?? []).forEach((l: any) => rows.push(["  " + l.accountName, fmt(l.amount)]));
  rows.push(["Total Pendapatan", fmt(report.revenue?.total)]);
  rows.push(["", ""]);
  (report.cogs?.lines ?? []).forEach((l: any) => rows.push(["  " + l.accountName, fmt(l.amount)]));
  if (report.cogs?.total) rows.push(["Total HPP", fmt(report.cogs.total)]);
  rows.push(["LABA KOTOR", fmt(report.grossProfit)]);
  rows.push(["", ""]);
  (report.expenses?.lines ?? []).forEach((l: any) => rows.push(["  " + l.accountName, fmt(l.amount)]));
  if (report.expenses?.total) rows.push(["Total Beban Operasional", fmt(report.expenses.total)]);
  (report.otherExpenses?.lines ?? []).forEach((l: any) => rows.push(["  " + l.accountName, fmt(l.amount)]));
  if (report.otherExpenses?.total) rows.push(["Total Beban Lain", fmt(report.otherExpenses.total)]);
  rows.push(["LABA BERSIH", fmt(report.netIncome)]);

  autoTable(doc, {
    startY: 42,
    head: [["Keterangan", "Jumlah (Rp)"]],
    body: rows,
    columnStyles: { 1: { halign: "right" } },
    headStyles: { fillColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    didParseCell: (data: any) => {
      const bold = ["Total Pendapatan", "LABA KOTOR", "Total HPP", "Total Beban Operasional", "Total Beban Lain", "LABA BERSIH"];
      if (data.section === "body" && bold.some((k) => String(data.row.raw?.[0]).startsWith(k))) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  doc.save(`laba-rugi-${startsOn?.toISOString().slice(0, 7) ?? "export"}.pdf`);
}

export async function exportBalanceSheetPdf(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  pdfHeader(doc, "Neraca", bizName, periodLabel(startsOn, endsOn));

  const rows: string[][] = [];
  rows.push(["ASET", "", ""]);
  (report.assets?.lines ?? []).forEach((l: any) => rows.push(["", l.accountName, fmt(l.amount)]));
  rows.push(["", "Total Aset", fmt(report.totalAssets)]);
  rows.push(["", "", ""]);
  rows.push(["LIABILITAS", "", ""]);
  (report.liabilities?.lines ?? []).forEach((l: any) => rows.push(["", l.accountName, fmt(l.amount)]));
  if (report.liabilities?.total) rows.push(["", "Total Liabilitas", fmt(report.liabilities.total)]);
  rows.push(["EKUITAS", "", ""]);
  (report.equity?.lines ?? []).forEach((l: any) => rows.push(["", l.accountName, fmt(l.amount)]));
  if (report.currentPeriodEarnings) rows.push(["", "Laba Periode Berjalan", fmt(report.currentPeriodEarnings.amount)]);
  rows.push(["", "Total Liabilitas & Ekuitas", fmt(report.totalLiabilitiesAndEquity)]);

  autoTable(doc, {
    startY: 42,
    head: [["Kelompok", "Akun", "Jumlah (Rp)"]],
    body: rows,
    columnStyles: { 2: { halign: "right" } },
    headStyles: { fillColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    didParseCell: (data: any) => {
      const bold = ["Total Aset", "Total Liabilitas", "Total Liabilitas & Ekuitas", "ASET", "LIABILITAS", "EKUITAS"];
      if (data.section === "body" && bold.some((k) => String(data.row.raw?.[0] ?? data.row.raw?.[1]).includes(k))) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  doc.save(`neraca-${startsOn?.toISOString().slice(0, 7) ?? "export"}.pdf`);
}

export async function exportGeneralLedgerPdf(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  pdfHeader(doc, "Buku Besar", bizName, periodLabel(startsOn, endsOn));

  const rows = (report.accounts ?? []).map((r: any) => [
    r.accountCode ? `${r.accountCode} ${r.accountName}` : r.accountName,
    fmt(r.openingBalance),
    fmt(r.periodDebit),
    fmt(r.periodCredit),
    fmt(r.closingBalance),
  ]);

  autoTable(doc, {
    startY: 42,
    head: [["Akun", "Saldo Awal", "Debit", "Kredit", "Saldo Akhir"]],
    body: rows,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    headStyles: { fillColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });
  doc.save(`buku-besar-${startsOn?.toISOString().slice(0, 7) ?? "export"}.pdf`);
}

export async function exportTrialBalancePdf(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  pdfHeader(doc, "Neraca Saldo", bizName, periodLabel(startsOn, endsOn));

  const rows = (report.rows ?? []).map((r: any) => [r.accountName, fmt(r.debit), fmt(r.credit)]);
  rows.push(["TOTAL", fmt(report.totalDebit), fmt(report.totalCredit)]);

  autoTable(doc, {
    startY: 42,
    head: [["Akun", "Debit (Rp)", "Kredit (Rp)"]],
    body: rows,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    headStyles: { fillColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.raw?.[0] === "TOTAL") data.cell.styles.fontStyle = "bold";
    },
  });
  doc.save(`neraca-saldo-${startsOn?.toISOString().slice(0, 7) ?? "export"}.pdf`);
}

// ─── Excel ──────────────────────────────────────────────────────────────────

function xlsxSave(wb: import("xlsx").WorkBook, filename: string) {
  import("xlsx").then(({ utils, writeFile }) => {
    writeFile(wb, filename);
  });
}

export async function exportProfitLossExcel(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const XLSX = await import("xlsx");
  const rows = [
    [bizName], ["LAPORAN LABA RUGI"], [`Periode: ${periodLabel(startsOn, endsOn)}`], [],
    ["Keterangan", "Jumlah (Rp)"],
    ["PENDAPATAN"],
    ...(report.revenue?.lines ?? []).map((l: any) => [l.accountName, Number(l.amount ?? 0)]),
    ["Total Pendapatan", Number(report.revenue?.total ?? 0)],
    [],
    ["HARGA POKOK PENJUALAN"],
    ...(report.cogs?.lines ?? []).map((l: any) => [l.accountName, Number(l.amount ?? 0)]),
    ["Total HPP", Number(report.cogs?.total ?? 0)],
    ["LABA KOTOR", Number(report.grossProfit ?? 0)],
    [],
    ["BEBAN OPERASIONAL"],
    ...(report.expenses?.lines ?? []).map((l: any) => [l.accountName, Number(l.amount ?? 0)]),
    ["Total Beban Operasional", Number(report.expenses?.total ?? 0)],
    ["BEBAN LAIN-LAIN"],
    ...(report.otherExpenses?.lines ?? []).map((l: any) => [l.accountName, Number(l.amount ?? 0)]),
    ["Total Beban Lain", Number(report.otherExpenses?.total ?? 0)],
    [],
    ["LABA BERSIH", Number(report.netIncome ?? 0)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 40 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laba Rugi");
  XLSX.writeFile(wb, `laba-rugi-${startsOn?.toISOString().slice(0, 7) ?? "export"}.xlsx`);
}

export async function exportBalanceSheetExcel(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const XLSX = await import("xlsx");
  const rows = [
    [bizName], ["NERACA"], [`Periode: ${periodLabel(startsOn, endsOn)}`], [],
    ["Kelompok", "Akun", "Jumlah (Rp)"],
    ["ASET"],
    ...(report.assets?.lines ?? []).map((l: any) => ["", l.accountName, Number(l.amount ?? 0)]),
    ["", "Total Aset", Number(report.totalAssets ?? 0)],
    [],
    ["LIABILITAS"],
    ...(report.liabilities?.lines ?? []).map((l: any) => ["", l.accountName, Number(l.amount ?? 0)]),
    [],
    ["EKUITAS"],
    ...(report.equity?.lines ?? []).map((l: any) => ["", l.accountName, Number(l.amount ?? 0)]),
    ...(report.currentPeriodEarnings ? [["", "Laba Periode Berjalan", Number(report.currentPeriodEarnings.amount ?? 0)]] : []),
    ["", "Total Liabilitas & Ekuitas", Number(report.totalLiabilitiesAndEquity ?? 0)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 35 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Neraca");
  XLSX.writeFile(wb, `neraca-${startsOn?.toISOString().slice(0, 7) ?? "export"}.xlsx`);
}

export async function exportGeneralLedgerExcel(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const XLSX = await import("xlsx");
  const rows = [
    [bizName], ["BUKU BESAR"], [`Periode: ${periodLabel(startsOn, endsOn)}`], [],
    ["Akun", "Saldo Awal (Rp)", "Debit (Rp)", "Kredit (Rp)", "Saldo Akhir (Rp)"],
    ...(report.accounts ?? []).map((r: any) => [
      r.accountCode ? `${r.accountCode} ${r.accountName}` : r.accountName,
      Number(r.openingBalance ?? 0),
      Number(r.periodDebit ?? 0),
      Number(r.periodCredit ?? 0),
      Number(r.closingBalance ?? 0),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Buku Besar");
  XLSX.writeFile(wb, `buku-besar-${startsOn?.toISOString().slice(0, 7) ?? "export"}.xlsx`);
}

export async function exportTrialBalanceExcel(report: any, bizName: string, startsOn?: Date, endsOn?: Date) {
  const XLSX = await import("xlsx");
  const rows = [
    [bizName], ["NERACA SALDO"], [`Periode: ${periodLabel(startsOn, endsOn)}`], [],
    ["Akun", "Debit (Rp)", "Kredit (Rp)"],
    ...(report.rows ?? []).map((r: any) => [r.accountName, Number(r.debit ?? 0), Number(r.credit ?? 0)]),
    ["TOTAL", Number(report.totalDebit ?? 0), Number(report.totalCredit ?? 0)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Neraca Saldo");
  XLSX.writeFile(wb, `neraca-saldo-${startsOn?.toISOString().slice(0, 7) ?? "export"}.xlsx`);
}
