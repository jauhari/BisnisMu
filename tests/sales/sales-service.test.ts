import { describe, expect, it } from "vitest";
import { JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import { AccountSnapshot, FiscalPeriodSnapshot, TenantContext as ATC, ValidatedJournal } from "../../src/features/accounting/domain/accounting-types";
import { InventoryService } from "../../src/features/inventory/application/inventory-service";
import { PaymentService } from "../../src/features/payment/application/payment-service";
import { SalesRepository, SalesAuditEvent } from "../../src/features/sales/application/sales-repository";
import { SalesService } from "../../src/features/sales/application/sales-service";
import { CreateSalesOrderInput, CustomerSnapshot, SalesOrderEntity, SalesOrderItemEntity, SalesStatus, TenantContext } from "../../src/features/sales/domain/sales-types";
import { ProductEntity, ProductPriceEntity, ProviderProductEntity } from "../../src/features/inventory/domain/inventory-types";

const accounts: AccountSnapshot[] = [
  { id: "cash", businessId: "biz-1", code: "110101", name: "Cash", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "ar", businessId: "biz-1", code: "110201", name: "AR", groupCode: 1, subtype: "accounts_receivable", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "inventory", businessId: "biz-1", code: "110601", name: "Inventory", groupCode: 1, subtype: "inventory", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "deposit", businessId: "biz-1", code: "210201", name: "Deposit", groupCode: 2, subtype: "customer_deposit", normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "revenue", businessId: "biz-1", code: "410101", name: "Revenue", groupCode: 4, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "cogs", businessId: "biz-1", code: "510101", name: "COGS", groupCode: 5, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true }
];

class JR implements JournalRepository { posted: ValidatedJournal[] = []; replaced: Array<{ journalId: string; journal: ValidatedJournal }> = []; deleted: string[] = []; async findAccountsForPosting(ctx: ATC, ids: string[]) { return accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); } async findOpenFiscalPeriod(ctx: ATC): Promise<FiscalPeriodSnapshot | null> { return { id: "p", businessId: ctx.businessId, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isClosed: false }; } async findPostedJournalByIdempotencyKey() { return null; } async createPostedJournal(_: ATC, j: ValidatedJournal): Promise<PostedJournalResult> { this.posted.push(j); return { journalId: "j" + this.posted.length, journalNumber: "JV", postedAt: new Date(), totalDebit: j.totalDebit, totalCredit: j.totalCredit }; } async replacePostedJournal(_: ATC, journalId: string, journal: ValidatedJournal): Promise<PostedJournalResult> { this.replaced.push({ journalId, journal }); return { journalId, journalNumber: "JV-REPLACED", postedAt: new Date(), totalDebit: journal.totalDebit, totalCredit: journal.totalCredit }; } async deletePostedJournal(_: ATC, journalId: string) { this.deleted.push(journalId); return true; } async createAuditLog() {} }
class FakeInventory { stockOuts: unknown[] = []; digitals: unknown[] = []; async stockOut(c: unknown) { this.stockOuts.push(c); return {}; } async consumeDigitalProduct(c: unknown) { this.digitals.push(c); return { movement: { totalCost: 98500n }, float: {} }; } }
class FakePayment { payments = new Map<string, { id: string; allocatedAmount: bigint }>(); walletBalance = 10000n; async createPayment(c: { totalAmount: bigint }) { const p = { id: "pay" + (this.payments.size + 1), allocatedAmount: 0n, totalAmount: c.totalAmount }; this.payments.set(p.id, p); return p; } async allocatePayment(c: { paymentTransactionId: string; allocations: Array<{ method: string; amount: bigint }> }) { const p = this.payments.get(c.paymentTransactionId)!; const add = c.allocations.reduce((s, a) => s + a.amount, 0n); p.allocatedAmount += add; if (c.allocations.some((a) => a.method === "CUSTOMER_WALLET")) this.walletBalance -= c.allocations.filter((a) => a.method === "CUSTOMER_WALLET").reduce((s, a) => s + a.amount, 0n); return { payment: { id: p.id, allocatedAmount: p.allocatedAmount } }; } }
class SalesRepo implements SalesRepository { customers = new Map<string, CustomerSnapshot>(); products = new Map<string, ProductEntity>(); prices: ProductPriceEntity[] = []; providers: ProviderProductEntity[] = []; sales = new Map<string, SalesOrderEntity>(); audits: SalesAuditEvent[] = []; seq = 1; constructor() { this.customers.set("cust", { id: "cust", businessId: "biz-1", name: "Customer", isActive: true }); const physical: ProductEntity = { id: "physical", businessId: "biz-1", type: "PHYSICAL", sku: "P", name: "Physical", inventoryAccountId: "inventory", cogsAccountId: "cogs", revenueAccountId: "revenue", trackStock: true, isActive: true }; const digital: ProductEntity = { id: "digital", businessId: "biz-1", type: "DIGITAL", sku: "D", name: "Digital", cogsAccountId: "cogs", revenueAccountId: "revenue", trackStock: false, isActive: true }; const service: ProductEntity = { id: "service", businessId: "biz-1", type: "SERVICE", sku: "S", name: "Service", revenueAccountId: "revenue", trackStock: false, isActive: true }; [physical, digital, service].forEach((p) => this.products.set(p.id, p)); this.prices.push({ id: "pp", businessId: "biz-1", productId: "physical", priceType: "SELL", amount: 50000n, effectiveDate: new Date("2026-01-01"), priority: 1, isActive: true }, { id: "dp", businessId: "biz-1", productId: "digital", priceType: "SELL", amount: 100000n, effectiveDate: new Date("2026-01-01"), priority: 1, isActive: true }, { id: "sp", businessId: "biz-1", productId: "service", priceType: "SELL", amount: 25000n, effectiveDate: new Date("2026-01-01"), priority: 1, isActive: true }); this.providers.push({ id: "prov", businessId: "biz-1", productId: "digital", provider: "FASTPAY", providerSku: "PLN100", floatAccountId: "float", dynamicBuyPrice: 98500n, dynamicSellPrice: 100000n, isActive: true }); }
  async findCustomer(ctx: TenantContext, id: string) { const c = this.customers.get(id); return c?.businessId === ctx.businessId ? c : null; } async findProducts(ctx: TenantContext, ids: string[]) { return [...this.products.values()].filter((p) => p.businessId === ctx.businessId && ids.includes(p.id)); } async findPrices(ctx: TenantContext, ids: string[]) { return this.prices.filter((p) => p.businessId === ctx.businessId && ids.includes(p.productId)); } async findProviderProducts(ctx: TenantContext, ids: string[]) { return this.providers.filter((p) => p.businessId === ctx.businessId && ids.includes(p.productId)); } async findAccounts(ctx: TenantContext, ids: string[]) { return accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); } async nextSalesNumber() { return "SO-" + this.seq++; }
  async createSalesOrder(ctx: TenantContext, input: CreateSalesOrderInput, computed: { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint; items: Array<Omit<SalesOrderItemEntity, "id" | "salesOrderId">> }, salesNumber: string) { const id = "sale" + this.seq++; const items = computed.items.map((item, i) => ({ id: "si" + i, salesOrderId: id, ...item })); const sale: SalesOrderEntity = { id, businessId: ctx.businessId, salesNumber, customerId: input.customerId, saleDate: input.saleDate, status: "DRAFT", description: input.description, subtotal: computed.subtotal, discountTotal: computed.discountTotal, taxTotal: computed.taxTotal, totalAmount: computed.totalAmount, paidAmount: 0n, revenueSettlementAccountId: input.revenueSettlementAccountId, arAccountId: input.arAccountId ?? null, createdByUserId: ctx.actorUserId, items }; this.sales.set(id, sale); return sale; }
  async findSalesOrder(ctx: TenantContext, id: string) { const s = this.sales.get(id); return s?.businessId === ctx.businessId ? s : null; } async listSalesOrders(ctx: TenantContext) { return { rows: [...this.sales.values()].filter((s) => s.businessId === ctx.businessId), total: [...this.sales.values()].filter((s) => s.businessId === ctx.businessId).length }; }
  async updateSalesOrder(ctx: TenantContext, id: string, input: CreateSalesOrderInput, computed: { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint; items: Array<Omit<SalesOrderItemEntity, "id" | "salesOrderId">> }) { const s = (await this.findSalesOrder(ctx, id))!; const items = computed.items.map((item, i) => ({ id: "usi" + i, salesOrderId: id, ...item })); const updated: SalesOrderEntity = { ...s, customerId: input.customerId, saleDate: input.saleDate, description: input.description, subtotal: computed.subtotal, discountTotal: computed.discountTotal, taxTotal: computed.taxTotal, totalAmount: computed.totalAmount, revenueSettlementAccountId: input.revenueSettlementAccountId, arAccountId: input.arAccountId ?? null, items }; this.sales.set(id, updated); return updated; }
  async deleteSalesOrder(ctx: TenantContext, id: string) { const s = await this.findSalesOrder(ctx, id); if (!s) return false; this.sales.delete(id); return true; }
  async deleteAnySalesOrder(ctx: TenantContext, id: string) { const s = await this.findSalesOrder(ctx, id); if (!s) return false; this.sales.delete(id); return true; }
  async updateSalesStatus(ctx: TenantContext, id: string, status: SalesStatus, paidAmount?: bigint, paymentTransactionId?: string, postedJournalId?: string) { const s = (await this.findSalesOrder(ctx, id))!; const u: SalesOrderEntity = { ...s, status, paidAmount: paidAmount ?? s.paidAmount, paymentTransactionId: paymentTransactionId ?? s.paymentTransactionId ?? null, postedJournalId: postedJournalId ?? s.postedJournalId ?? null }; this.sales.set(id, u); return u; } async createAuditLog(_: TenantContext, e: SalesAuditEvent) { this.audits.push(e); } }
function setup() { const jr = new JR(); const inv = new FakeInventory(); const pay = new FakePayment(); const repo = new SalesRepo(); const sales = new SalesService(repo, new JournalPostingService(jr), inv as unknown as InventoryService, pay as unknown as PaymentService); return { jr, inv, pay, repo, sales }; }
async function createAndConfirm(productId: string) { const s = setup(); const sale = await s.sales.createSalesOrder({ businessId: "biz-1", actorUserId: "user", customerId: "cust", saleDate: new Date("2026-05-30"), description: "Sale", revenueSettlementAccountId: "revenue", arAccountId: "ar", items: [productId === "digital" ? { productId, quantity: 1n, locationId: "main", providerProductId: "prov" } : { productId, quantity: 1n, locationId: "main" }] }); const confirmed = await s.sales.confirmSalesOrder({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id }); return { ...s, sale: confirmed.sale }; }
describe("SalesService", () => {
  it("handles physical sale", async () => { const { inv, sale } = await createAndConfirm("physical"); expect(sale.status).toBe("CONFIRMED"); expect(inv.stockOuts).toHaveLength(1); });
  it("handles digital sale", async () => { const { inv } = await createAndConfirm("digital"); expect(inv.digitals).toHaveLength(1); });
  it("uses customer deposit", async () => { const { pay, sales, sale } = await createAndConfirm("service"); const r = await sales.allocatePayment({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, allocations: [{ method: "CUSTOMER_WALLET", walletId: "wallet", amount: 25000n }] }); expect(r.sale.status).toBe("PAID"); expect(pay.walletBalance).toBe(-15000n); });
  it("supports partial payment", async () => { const { sales, sale } = await createAndConfirm("physical"); const r = await sales.allocatePayment({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, allocations: [{ method: "CASH", accountId: "cash", amount: 20000n }] }); expect(r.sale.status).toBe("PARTIALLY_PAID"); });
  it("supports installment", async () => { const { sales, sale } = await createAndConfirm("physical"); await sales.allocatePayment({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, allocations: [{ method: "CASH", accountId: "cash", amount: 20000n }] }); const r = await sales.allocatePayment({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, allocations: [{ method: "CASH", accountId: "cash", amount: 30000n }] }); expect(r.sale.status).toBe("PAID"); });
  it("records float consumption for digital", async () => { const { inv } = await createAndConfirm("digital"); expect(inv.digitals[0]).toMatchObject({ productId: "digital", quantity: 1n }); });
  it("posts COGS for physical via inventory", async () => { const { inv } = await createAndConfirm("physical"); expect(inv.stockOuts[0]).toMatchObject({ productId: "physical", quantity: 1n }); });
  it("posts revenue", async () => { const { jr } = await createAndConfirm("service"); expect(jr.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["ar", "DEBIT"], ["revenue", "CREDIT"]]); });

  it("updates draft sales order before confirmation", async () => {
    const { sales } = setup();
    const sale = await sales.createSalesOrder({ businessId: "biz-1", actorUserId: "user", customerId: "cust", saleDate: new Date("2026-05-30"), description: "Sale", revenueSettlementAccountId: "revenue", arAccountId: "ar", items: [{ productId: "service", quantity: 1n }] });
    const updated = await sales.updateSalesOrder({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, customerId: "cust", saleDate: new Date("2026-05-31"), description: "Updated sale", revenueSettlementAccountId: "revenue", arAccountId: "ar", items: [{ productId: "service", quantity: 2n }] });
    expect(updated.description).toBe("Updated sale");
    expect(updated.totalAmount).toBe(50000n);
  });

  it("deletes draft sales orders only before confirmation", async () => {
    const { repo, sales } = setup();
    const sale = await sales.createSalesOrder({ businessId: "biz-1", actorUserId: "user", customerId: "cust", saleDate: new Date("2026-05-30"), description: "Sale", revenueSettlementAccountId: "revenue", arAccountId: "ar", items: [{ productId: "service", quantity: 1n }] });
    const deleted = await sales.deleteSalesOrder({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id });
    expect(deleted.id).toBe(sale.id);
    expect(repo.sales.has(sale.id)).toBe(false);
  });

  it("rejects updating confirmed sales orders", async () => {
    const { sales, sale } = await createAndConfirm("service");
    await expect(sales.updateSalesOrder({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, customerId: "cust", saleDate: new Date("2026-05-31"), description: "Updated sale", revenueSettlementAccountId: "revenue", arAccountId: "ar", items: [{ productId: "service", quantity: 2n }] })).rejects.toThrow(/Only draft/i);
  });

  it("voids confirmed sales orders without hard delete", async () => {
    const { repo, sales, sale } = await createAndConfirm("service");
    const voided = await sales.voidSalesOrder({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, reason: "Salah input order" });
    expect(voided.status).toBe("VOID");
    expect(repo.sales.has(sale.id)).toBe(true);
  });

  it("hard updates confirmed sales orders when explicitly allowed", async () => {
    const { jr, sales, sale } = await createAndConfirm("service");
    const updated = await sales.updateAnySalesOrder({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id, customerId: "cust", saleDate: new Date("2026-05-31"), description: "Koreksi sale", revenueSettlementAccountId: "revenue", arAccountId: "ar", items: [{ productId: "service", quantity: 2n }] });
    expect(updated.status).toBe("CONFIRMED");
    expect(updated.totalAmount).toBe(50000n);
    expect(jr.replaced[0]?.journalId).toBe("j1");
    expect(jr.replaced[0]?.journal.totalDebit).toBe(50000n);
  });

  it("hard deletes confirmed sales orders when explicitly allowed", async () => {
    const { jr, repo, sales, sale } = await createAndConfirm("service");
    const deleted = await sales.deleteAnySalesOrder({ businessId: "biz-1", actorUserId: "user", salesOrderId: sale.id });
    expect(deleted.status).toBe("CONFIRMED");
    expect(repo.sales.has(sale.id)).toBe(false);
    expect(jr.deleted).toEqual(["j1"]);
  });
});
