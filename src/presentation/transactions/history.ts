export type TransactionHistorySource = "DAILY_SALE" | "SALES_ORDER" | "CASH_TRANSACTION" | "PAYROLL_PAYMENT";
export type TransactionHistoryDirection = "IN" | "OUT" | "TRANSFER";
export type TransactionHistoryTypeFilter = "all" | "sales" | "cash" | "payroll";

const PAYROLL_ROLE_LABEL: Record<string, string> = { DOCTOR: "Dokter", NURSE: "Perawat", STAFF: "Staf", OTHER: "Lainnya" };

export interface TransactionHistoryRow {
  id: string;
  source: TransactionHistorySource;
  kind: string;
  direction: TransactionHistoryDirection;
  reference: string;
  date: string;
  status: string;
  description: string;
  amount: string;
  paidAmount?: string;
  href: string;
}

export interface TransactionHistoryFilters {
  type: TransactionHistoryTypeFilter;
  status: string;
  query: string;
  startDate: string;
  endDate: string;
}

function isoDate(value: unknown): string {
  if (!value) return "";
  // Prisma returns @db.Date columns as real Date objects. String(date) yields
  // e.g. "Wed Jul 15 2026 ... GMT+0700 ...", whose "T" (from "GMT") used to
  // fool the ISO-string check below into slicing off a year-less fragment
  // that downstream date parsing then defaulted to the year 2001.
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  const text = String(value);
  return text.includes("T") ? text.slice(0, 10) : text;
}

function amountText(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value);
}

export function normalizeDailySale(row: any): TransactionHistoryRow {
  return {
    id: row.id,
    source: "DAILY_SALE",
    kind: "Penjualan Harian",
    direction: "IN",
    reference: row.id,
    date: isoDate(row.saleDate),
    status: row.status ?? "POSTED",
    description: row.description ?? row.items?.[0]?.revenueAccount?.name ?? "Penjualan harian",
    amount: amountText(row.totalAmount),
    href: `/sales/orders?dailySaleId=${row.id}`,
  };
}

export function normalizeSalesOrder(row: any): TransactionHistoryRow {
  return {
    id: row.id,
    source: "SALES_ORDER",
    kind: "Sales Order",
    direction: "IN",
    reference: row.salesNumber ?? row.id,
    date: isoDate(row.saleDate),
    status: row.status,
    description: row.description ?? "Sales order",
    amount: amountText(row.totalAmount),
    paidAmount: amountText(row.paidAmount),
    href: `/sales/orders?salesOrderId=${row.id}`,
  };
}

export function normalizeCashTransaction(row: any): TransactionHistoryRow {
  const direction: TransactionHistoryDirection = row.type === "TRANSFER" ? "TRANSFER" : row.type === "CASH_IN" ? "IN" : "OUT";
  return {
    id: row.id,
    source: "CASH_TRANSACTION",
    kind: row.type === "CASH_IN" ? "Pemasukan Kas" : row.type === "TRANSFER" ? "Transfer Kas" : "Pengeluaran Kas",
    direction,
    reference: row.transactionNumber ?? row.id,
    date: isoDate(row.transactionDate),
    status: row.status,
    description: row.description ?? "Transaksi kas",
    amount: amountText(row.amount),
    href: `/cash/transactions?transactionId=${row.id}`,
  };
}

export function normalizePayrollPayment(row: any): TransactionHistoryRow {
  const role = PAYROLL_ROLE_LABEL[row.payrollItem?.employeeRole] ?? "";
  const employeeName = row.payrollItem?.employeeName ?? "";
  return {
    id: row.id,
    source: "PAYROLL_PAYMENT",
    kind: "Pembayaran Gaji",
    direction: "OUT",
    reference: row.id,
    date: isoDate(row.paidAt),
    status: "POSTED",
    description: role ? `Gaji ${employeeName} (${role})` : `Gaji ${employeeName}`,
    amount: amountText(row.amount),
    href: `/payroll?runId=${row.payrollRunId}`,
  };
}

export function filterTransactionHistoryRows(rows: TransactionHistoryRow[], filters: TransactionHistoryFilters): TransactionHistoryRow[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.type === "sales" && (row.source === "CASH_TRANSACTION" || row.source === "PAYROLL_PAYMENT")) return false;
    if (filters.type === "cash" && row.source !== "CASH_TRANSACTION") return false;
    if (filters.type === "payroll" && row.source !== "PAYROLL_PAYMENT") return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.startDate && row.date < filters.startDate) return false;
    if (filters.endDate && row.date > filters.endDate) return false;
    if (query) {
      const haystack = [row.reference, row.kind, row.status, row.description, row.amount].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
