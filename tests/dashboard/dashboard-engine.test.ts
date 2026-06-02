import { describe, expect, it } from "vitest";
import { getCashAnalytics, getCustomerAnalytics, getDashboardOverview, getFloatAnalytics, getInventoryAnalytics, getSalesAnalytics, getVendorAnalytics } from "../../src/features/dashboard";
import { DashboardDateRange, DashboardInput } from "../../src/features/dashboard/domain/dashboard-types";

const range: DashboardDateRange = { businessId: "biz-1", startsOn: new Date("2026-05-01T00:00:00.000Z"), endsOn: new Date("2026-05-31T23:59:59.999Z"), asOf: new Date("2026-05-31T12:00:00.000Z"), lowStockThreshold: 5n, lowFloatThreshold: 100n };

const input: DashboardInput = {
  products: [
    { id: "p1", businessId: "biz-1", type: "PHYSICAL", sku: "SKU-1", name: "Nasi", categoryId: "cat-food", revenueAccountId: "rev", trackStock: true, isActive: true },
    { id: "p2", businessId: "biz-1", type: "PHYSICAL", sku: "SKU-2", name: "Teh", categoryId: "cat-drink", revenueAccountId: "rev", trackStock: true, isActive: true },
    { id: "p3", businessId: "biz-2", type: "PHYSICAL", sku: "SKU-X", name: "Other", revenueAccountId: "rev", trackStock: true, isActive: true }
  ],
  productCategories: [
    { id: "cat-food", businessId: "biz-1", name: "Food", isActive: true },
    { id: "cat-drink", businessId: "biz-1", name: "Drink", isActive: true }
  ],
  salesOrders: [
    { id: "s1", businessId: "biz-1", salesNumber: "S-1", customerId: "c1", saleDate: new Date("2026-05-31T02:00:00.000Z"), status: "PAID", description: "today", subtotal: 1000n, discountTotal: 100n, taxTotal: 0n, totalAmount: 900n, paidAmount: 900n, revenueSettlementAccountId: "cash", createdByUserId: "u", items: [{ id: "si1", businessId: "biz-1", salesOrderId: "s1", productId: "p1", productType: "PHYSICAL", quantity: 3n, unitPrice: 300n, discountAmount: 0n, taxAmount: 0n, lineTotal: 900n }] },
    { id: "s2", businessId: "biz-1", salesNumber: "S-2", customerId: "c2", saleDate: new Date("2026-05-15T02:00:00.000Z"), status: "PARTIALLY_PAID", description: "month", subtotal: 500n, discountTotal: 0n, taxTotal: 0n, totalAmount: 500n, paidAmount: 200n, revenueSettlementAccountId: "cash", createdByUserId: "u", items: [{ id: "si2", businessId: "biz-1", salesOrderId: "s2", productId: "p2", productType: "PHYSICAL", quantity: 5n, unitPrice: 100n, discountAmount: 0n, taxAmount: 0n, lineTotal: 500n }] },
    { id: "s3", businessId: "biz-1", salesNumber: "S-3", customerId: "c1", saleDate: new Date("2026-04-12T02:00:00.000Z"), status: "PAID", description: "prev", subtotal: 400n, discountTotal: 0n, taxTotal: 0n, totalAmount: 400n, paidAmount: 400n, revenueSettlementAccountId: "cash", createdByUserId: "u", items: [] },
    { id: "s4", businessId: "biz-2", salesNumber: "S-X", customerId: "cx", saleDate: new Date("2026-05-31T02:00:00.000Z"), status: "PAID", description: "other", subtotal: 9999n, discountTotal: 0n, taxTotal: 0n, totalAmount: 9999n, paidAmount: 9999n, revenueSettlementAccountId: "cash", createdByUserId: "u", items: [] }
  ],
  profitAndLoss: { businessId: "biz-1", startsOn: range.startsOn, endsOn: range.endsOn, revenue: { lines: [], total: 1400n }, cogs: { lines: [], total: 600n }, expenses: { lines: [], total: 200n }, otherExpenses: { lines: [], total: 100n }, grossProfit: 800n, netIncome: 500n },
  cashBalances: [
    { businessId: "biz-1", accountId: "cash", subtype: "cash", balance: 300n },
    { businessId: "biz-1", accountId: "bank", subtype: "bank", balance: 1200n },
    { businessId: "biz-2", accountId: "cash-x", subtype: "cash", balance: 9999n }
  ],
  cashTransactions: [
    { id: "ct1", businessId: "biz-1", transactionNumber: "C-1", type: "CASH_IN", status: "POSTED", transactionDate: new Date("2026-05-31T00:00:00.000Z"), cashAccountId: "cash", amount: 200n, description: "in", tags: [], createdByUserId: "u" },
    { id: "ct2", businessId: "biz-1", transactionNumber: "C-2", type: "CASH_OUT", status: "POSTED", transactionDate: new Date("2026-05-31T00:00:00.000Z"), cashAccountId: "cash", amount: 50n, description: "out", tags: [], createdByUserId: "u" }
  ],
  invoices: [
    { id: "i1", businessId: "biz-1", invoiceNumber: "I-1", customerId: "c1", status: "POSTED", issueDate: new Date("2026-05-01T00:00:00.000Z"), dueDate: new Date("2026-05-10T00:00:00.000Z"), arAccountId: "ar", revenueAccountId: "rev", subtotal: 1000n, paidAmount: 200n, description: "inv" },
    { id: "i2", businessId: "biz-1", invoiceNumber: "I-2", customerId: "c2", status: "PAID", issueDate: new Date("2026-05-01T00:00:00.000Z"), dueDate: new Date("2026-06-10T00:00:00.000Z"), arAccountId: "ar", revenueAccountId: "rev", subtotal: 300n, paidAmount: 300n, description: "paid" }
  ],
  bills: [
    { id: "b1", businessId: "biz-1", billNumber: "B-1", vendorId: "v1", status: "POSTED", issueDate: new Date("2026-05-01T00:00:00.000Z"), dueDate: new Date("2026-05-09T00:00:00.000Z"), apAccountId: "ap", expenseAccountId: "ex", subtotal: 700n, paidAmount: 100n, description: "bill" },
    { id: "b2", businessId: "biz-1", billNumber: "B-2", vendorId: "v2", status: "POSTED", issueDate: new Date("2026-05-01T00:00:00.000Z"), dueDate: new Date("2026-06-09T00:00:00.000Z"), apAccountId: "ap", expenseAccountId: "ex", subtotal: 300n, paidAmount: 0n, description: "bill2" }
  ],
  inventoryBalances: [
    { id: "ib1", businessId: "biz-1", productId: "p1", locationId: "w1", quantity: 3n, averageCost: 100n, inventoryValue: 300n },
    { id: "ib2", businessId: "biz-1", productId: "p2", locationId: "w1", quantity: 20n, averageCost: 20n, inventoryValue: 400n }
  ],
  inventoryMovements: [
    { id: "m1", businessId: "biz-1", productId: "p1", type: "STOCK_OUT", movementDate: new Date("2026-05-20T00:00:00.000Z"), quantity: 10n, unitCost: 100n, totalCost: 1000n, balanceAfter: 3n, averageCostAfter: 100n, description: "out" },
    { id: "m2", businessId: "biz-1", productId: "p2", type: "STOCK_OUT", movementDate: new Date("2026-05-21T00:00:00.000Z"), quantity: 2n, unitCost: 20n, totalCost: 40n, balanceAfter: 20n, averageCostAfter: 20n, description: "out" }
  ],
  floatAccounts: [
    { id: "fa1", businessId: "biz-1", provider: "FASTPAY", name: "Fast", floatAssetAccountId: "fl", offsetAccountId: "off", currentBalance: 80n, isActive: true },
    { id: "fa2", businessId: "biz-1", provider: "PAYFAZZ", name: "Pay", floatAssetAccountId: "fl", offsetAccountId: "off", currentBalance: 200n, isActive: true }
  ],
  floatTransactions: [
    { id: "ft1", businessId: "biz-1", transactionNumber: "F-1", type: "CONSUME", floatAccountId: "fa1", transactionDate: new Date("2026-05-31T00:00:00.000Z"), amount: 30n, balanceAfter: 80n, description: "use", createdByUserId: "u" }
  ],
  customers: [
    { id: "c1", businessId: "biz-1", name: "Ani", isActive: true },
    { id: "c2", businessId: "biz-1", name: "Budi", isActive: false }
  ],
  customerWallets: [{ id: "w1", businessId: "biz-1", customerId: "c1", depositLiabilityAccountId: "dep", currentBalance: 150n, isActive: true }],
  vendors: [
    { id: "v1", businessId: "biz-1", name: "Supplier A", isActive: true },
    { id: "v2", businessId: "biz-1", name: "Supplier B", isActive: true }
  ]
};

describe("DashboardEngine module functions", () => {
  it("calculates sales KPIs and rankings", () => {
    const sales = getSalesAnalytics(range, input);
    expect(sales.salesToday).toBe(900n);
    expect(sales.salesThisMonth).toBe(1400n);
    expect(sales.salesGrowth).toBe(1000n);
    expect(sales.topProducts[0]).toMatchObject({ id: "p1", name: "Nasi", amount: 900n, quantity: 3n });
    expect(sales.topCategories[0]).toMatchObject({ id: "cat-food", name: "Food", amount: 900n });
  });

  it("calculates cash, receivable, payable, and profitability dashboard overview KPIs", () => {
    const overview = getDashboardOverview(range, input);
    expect(overview.profitability).toEqual({ grossProfit: 800n, netProfit: 500n, profitMargin: 35.71 });
    expect(overview.cash).toEqual({ cashOnHand: 300n, bankBalance: 1200n, cashFlowToday: 150n });
    expect(overview.receivable).toEqual({ totalReceivable: 800n, overdueReceivable: 800n });
    expect(overview.payable).toEqual({ totalPayable: 900n, overduePayable: 600n });
  });

  it("calculates inventory KPIs", () => {
    const inventory = getInventoryAnalytics(range, input);
    expect(inventory.inventoryValue).toBe(700n);
    expect(inventory.lowStockItems).toEqual([{ productId: "p1", sku: "SKU-1", name: "Nasi", quantity: 3n, inventoryValue: 300n }]);
    expect(inventory.fastMovingItems[0]).toMatchObject({ id: "p1", name: "Nasi", quantity: 10n });
    expect(inventory.slowMovingItems[0]).toMatchObject({ id: "p2", name: "Teh", quantity: 2n });
  });

  it("calculates float KPIs", () => {
    const float = getFloatAnalytics(range, input);
    expect(float.totalFloatBalance).toBe(280n);
    expect(float.floatUsageToday).toBe(30n);
    expect(float.lowFloatProviders).toEqual([{ provider: "FASTPAY", balance: 80n, accountCount: 1 }]);
  });

  it("calculates customer and vendor KPIs", () => {
    const customer = getCustomerAnalytics(range, input);
    const vendor = getVendorAnalytics(range, input);
    expect(customer.activeCustomers).toBe(1);
    expect(customer.customerDepositBalance).toBe(150n);
    expect(customer.topCustomers[0]).toMatchObject({ id: "c1", name: "Ani", amount: 1000n });
    expect(vendor.vendorOutstandingBalance).toBe(900n);
    expect(vendor.topVendors[0]).toMatchObject({ id: "v1", name: "Supplier A", amount: 700n });
  });

  it("keeps dashboard analytics tenant and date-range isolated", () => {
    const sales = getSalesAnalytics({ ...range, businessId: "biz-2" }, input);
    expect(sales.salesToday).toBe(9999n);
    expect(sales.salesThisMonth).toBe(9999n);
    const cash = getCashAnalytics({ ...range, businessId: "biz-2" }, input);
    expect(cash.cashOnHand).toBe(9999n);
  });
});
