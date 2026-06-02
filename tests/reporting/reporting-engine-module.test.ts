import { describe, expect, it } from "vitest";
import {
  generateBalanceSheet,
  generateCashFlow,
  generateFloatReport,
  generateGeneralLedger,
  generateInventoryReport,
  generateProfitLoss,
  generatePurchaseReport,
  generateSalesReport,
  generateTrialBalance,
  ReportAccount
} from "../../src/features/reporting";
import { LedgerLineSource } from "../../src/features/reporting/domain/reporting-types";
import { SalesOrderEntity } from "../../src/features/sales/domain/sales-types";
import { PurchaseOrderEntity, PurchaseReceiptEntity, PurchaseReturnEntity } from "../../src/features/purchase/domain/purchase-types";
import { InventoryBalanceEntity, InventoryMovementEntity, ProductEntity } from "../../src/features/inventory/domain/inventory-types";
import { FloatAccountEntity, FloatBalanceSnapshotEntity, FloatTransactionEntity } from "../../src/features/float/domain/float-types";

const range = { businessId: "biz-1", startsOn: new Date("2026-01-01T00:00:00.000Z"), endsOn: new Date("2026-12-31T00:00:00.000Z") };

const accounts: ReportAccount[] = [
  { id: "cash", businessId: "biz-1", code: "110101", name: "Kas", groupCode: 1, normalBalance: "DEBIT", subtype: "cash", isActive: true },
  { id: "asset", businessId: "biz-1", code: "130101", name: "Peralatan", groupCode: 1, normalBalance: "DEBIT", subtype: "fixed_asset", isActive: true },
  { id: "capital", businessId: "biz-1", code: "310101", name: "Modal", groupCode: 3, normalBalance: "CREDIT", isActive: true },
  { id: "revenue", businessId: "biz-1", code: "410101", name: "Penjualan", groupCode: 4, normalBalance: "CREDIT", isActive: true },
  { id: "expense", businessId: "biz-1", code: "610101", name: "Beban", groupCode: 6, normalBalance: "DEBIT", isActive: true }
];

function line(input: { journalId: string; journalNumber: string; accountId: string; date: string; side: "DEBIT" | "CREDIT"; amount: bigint; lineNo: number; businessId?: string }): LedgerLineSource {
  const account = accounts.find((row) => row.id === input.accountId)!;
  return {
    id: input.journalId + "-" + input.lineNo,
    businessId: input.businessId ?? account.businessId,
    journalId: input.journalId,
    journalNumber: input.journalNumber,
    transactionDate: new Date(input.date),
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    accountGroupCode: account.groupCode,
    accountNormalBalance: account.normalBalance,
    description: input.journalNumber,
    source: "TEST",
    side: input.side,
    amount: input.amount,
    lineNo: input.lineNo
  };
}

const openingLines = [
  line({ journalId: "j-open", journalNumber: "JV-001", accountId: "cash", date: "2025-12-31T00:00:00.000Z", side: "DEBIT", amount: 1000n, lineNo: 1 }),
  line({ journalId: "j-open", journalNumber: "JV-001", accountId: "capital", date: "2025-12-31T00:00:00.000Z", side: "CREDIT", amount: 1000n, lineNo: 2 })
];

const periodLines = [
  line({ journalId: "j-sale", journalNumber: "JV-002", accountId: "cash", date: "2026-01-10T00:00:00.000Z", side: "DEBIT", amount: 500n, lineNo: 1 }),
  line({ journalId: "j-sale", journalNumber: "JV-002", accountId: "revenue", date: "2026-01-10T00:00:00.000Z", side: "CREDIT", amount: 500n, lineNo: 2 }),
  line({ journalId: "j-expense", journalNumber: "JV-003", accountId: "expense", date: "2026-01-11T00:00:00.000Z", side: "DEBIT", amount: 200n, lineNo: 1 }),
  line({ journalId: "j-expense", journalNumber: "JV-003", accountId: "cash", date: "2026-01-11T00:00:00.000Z", side: "CREDIT", amount: 200n, lineNo: 2 })
];

describe("reporting module exports", () => {
  it("exposes reusable accounting report generators", () => {
    expect(generateGeneralLedger(range, accounts, openingLines, periodLines).accounts.find((account) => account.accountId === "cash")?.closingBalance).toBe(1300n);
    expect(generateTrialBalance(range, accounts, [...openingLines, ...periodLines]).isBalanced).toBe(true);
    expect(generateProfitLoss(range, accounts, periodLines).netIncome).toBe(300n);
    expect(generateBalanceSheet(range, accounts, [...openingLines, ...periodLines]).totalAssets).toBe(1300n);
    expect(generateCashFlow(range, accounts, openingLines, periodLines).endingCashBalance).toBe(1300n);
  });

  it("generates a sales report with date and business filtering", () => {
    const orders: SalesOrderEntity[] = [
      { id: "s1", businessId: "biz-1", salesNumber: "S-1", customerId: "c1", saleDate: new Date("2026-02-01T00:00:00.000Z"), status: "PAID", description: "Sale", subtotal: 1000n, discountTotal: 100n, taxTotal: 10n, totalAmount: 910n, paidAmount: 910n, revenueSettlementAccountId: "cash", createdByUserId: "u1", items: [{ id: "si1", businessId: "biz-1", salesOrderId: "s1", productId: "p1", productType: "PHYSICAL", quantity: 2n, unitPrice: 500n, discountAmount: 100n, taxAmount: 10n, lineTotal: 910n }] },
      { id: "s2", businessId: "biz-2", salesNumber: "S-2", customerId: "c2", saleDate: new Date("2026-02-01T00:00:00.000Z"), status: "PAID", description: "Other", subtotal: 999n, discountTotal: 0n, taxTotal: 0n, totalAmount: 999n, paidAmount: 999n, revenueSettlementAccountId: "cash", createdByUserId: "u1", items: [] }
    ];
    const report = generateSalesReport(range, orders);
    expect(report.orderCount).toBe(1);
    expect(report.itemCount).toBe(2n);
    expect(report.totalAmount).toBe(910n);
    expect(report.byStatus.PAID.count).toBe(1);
  });

  it("generates a purchase report", () => {
    const orders: PurchaseOrderEntity[] = [{ id: "po1", businessId: "biz-1", orderNumber: "PO-1", supplierId: "v1", orderDate: new Date("2026-03-01T00:00:00.000Z"), status: "APPROVED", subtotal: 800n, discountTotal: 50n, taxTotal: 10n, totalAmount: 760n, grniAccountId: "grni", apAccountId: "ap", createdByUserId: "u1", items: [] }];
    const receipts: PurchaseReceiptEntity[] = [{ id: "pr1", businessId: "biz-1", purchaseOrderId: "po1", receiptNumber: "RCV-1", receiptDate: new Date("2026-03-02T00:00:00.000Z"), totalCost: 700n, postedJournalId: "j1", createdByUserId: "u1" }];
    const returns: PurchaseReturnEntity[] = [{ id: "ret1", businessId: "biz-1", purchaseOrderId: "po1", returnNumber: "RET-1", returnDate: new Date("2026-03-03T00:00:00.000Z"), totalCost: 100n, postedJournalId: "j2", createdByUserId: "u1" }];
    const report = generatePurchaseReport(range, { orders, receipts, returns });
    expect(report.orderCount).toBe(1);
    expect(report.orderedAmount).toBe(760n);
    expect(report.netReceivedCost).toBe(600n);
  });

  it("generates an inventory report", () => {
    const products: ProductEntity[] = [{ id: "p1", businessId: "biz-1", type: "PHYSICAL", sku: "SKU-1", name: "Item", revenueAccountId: "revenue", trackStock: true, isActive: true }];
    const balances: InventoryBalanceEntity[] = [{ id: "b1", businessId: "biz-1", productId: "p1", locationId: "w1", quantity: 5n, averageCost: 100n, inventoryValue: 500n }];
    const movements: InventoryMovementEntity[] = [{ id: "m1", businessId: "biz-1", productId: "p1", type: "STOCK_IN", movementDate: new Date("2026-04-01T00:00:00.000Z"), quantity: 5n, unitCost: 100n, totalCost: 500n, balanceAfter: 5n, averageCostAfter: 100n, description: "Stock in" }];
    const report = generateInventoryReport(range, { products, balances, movements });
    expect(report.productCount).toBe(1);
    expect(report.balanceQuantity).toBe(5n);
    expect(report.inventoryValue).toBe(500n);
    expect(report.movementQuantityByType.STOCK_IN).toBe(5n);
  });

  it("generates a float report", () => {
    const accounts: FloatAccountEntity[] = [{ id: "fa1", businessId: "biz-1", provider: "FASTPAY", name: "Fastpay", floatAssetAccountId: "float", offsetAccountId: "cash", currentBalance: 300n, isActive: true }];
    const transactions: FloatTransactionEntity[] = [{ id: "ft1", businessId: "biz-1", transactionNumber: "FT-1", type: "TOPUP", floatAccountId: "fa1", transactionDate: new Date("2026-05-01T00:00:00.000Z"), amount: 500n, balanceAfter: 500n, description: "Topup", createdByUserId: "u1" }];
    const snapshots: FloatBalanceSnapshotEntity[] = [{ id: "fs1", businessId: "biz-1", floatAccountId: "fa1", snapshotDate: new Date("2026-05-02T00:00:00.000Z"), balance: 300n }];
    const report = generateFloatReport(range, { accounts, transactions, snapshots });
    expect(report.accountCount).toBe(1);
    expect(report.currentBalance).toBe(300n);
    expect(report.transactionAmountByType.TOPUP).toBe(500n);
    expect(report.latestSnapshotBalance).toBe(300n);
  });
});
