import { describe, expect, it } from "vitest";

import { filterTransactionHistoryRows, normalizeCashTransaction, normalizeDailySale, normalizeSalesOrder } from "../../src/presentation/transactions/history";

describe("transaction history presentation", () => {
  it("normalizes sales, daily sales, and cash rows into one table shape", () => {
    const daily = normalizeDailySale({
      id: "daily-1",
      saleDate: "2026-06-10T00:00:00.000Z",
      status: "POSTED",
      description: "Penjualan tiket",
      totalAmount: "150000",
      items: [{ revenueAccount: { name: "Tiket" } }],
    });
    const order = normalizeSalesOrder({
      id: "sale-1",
      salesNumber: "SO-001",
      saleDate: "2026-06-09T00:00:00.000Z",
      status: "DRAFT",
      description: "Order rombongan",
      totalAmount: "250000",
      paidAmount: "0",
    });
    const cash = normalizeCashTransaction({
      id: "cash-1",
      transactionNumber: "CASH-001",
      transactionDate: "2026-06-08T00:00:00.000Z",
      type: "CASH_OUT",
      status: "DRAFT",
      amount: "50000",
      description: "Beli perlengkapan",
    });

    expect(daily).toMatchObject({ id: "daily-1", source: "DAILY_SALE", kind: "Penjualan Harian", direction: "IN", reference: "daily-1" });
    expect(order).toMatchObject({ id: "sale-1", source: "SALES_ORDER", kind: "Sales Order", direction: "IN", reference: "SO-001" });
    expect(cash).toMatchObject({ id: "cash-1", source: "CASH_TRANSACTION", kind: "Pengeluaran Kas", direction: "OUT", reference: "CASH-001" });
  });

  it("filters by transaction type, status, search, and date range", () => {
    const rows = [
      normalizeCashTransaction({ id: "cash-1", transactionNumber: "CASH-001", transactionDate: "2026-06-08", type: "CASH_OUT", status: "DRAFT", amount: "50000", description: "Beli perlengkapan" }),
      normalizeSalesOrder({ id: "sale-1", salesNumber: "SO-001", saleDate: "2026-06-09", status: "CONFIRMED", description: "Order rombongan", totalAmount: "250000", paidAmount: "0" }),
      normalizeDailySale({ id: "daily-1", saleDate: "2026-06-10", status: "VOID", description: "Penjualan tiket", totalAmount: "150000", items: [] }),
    ];

    expect(filterTransactionHistoryRows(rows, { type: "sales", status: "all", query: "", startDate: "", endDate: "" }).map((row) => row.id)).toEqual(["sale-1", "daily-1"]);
    expect(filterTransactionHistoryRows(rows, { type: "all", status: "DRAFT", query: "", startDate: "", endDate: "" }).map((row) => row.id)).toEqual(["cash-1"]);
    expect(filterTransactionHistoryRows(rows, { type: "all", status: "all", query: "rombongan", startDate: "", endDate: "" }).map((row) => row.id)).toEqual(["sale-1"]);
    expect(filterTransactionHistoryRows(rows, { type: "all", status: "all", query: "", startDate: "2026-06-09", endDate: "2026-06-10" }).map((row) => row.id)).toEqual(["sale-1", "daily-1"]);
  });
});
