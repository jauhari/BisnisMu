import { describe, expect, it } from "vitest";
import { JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import { AccountSnapshot, FiscalPeriodSnapshot, TenantContext as ATC, ValidatedJournal } from "../../src/features/accounting/domain/accounting-types";
import { CreateAllocationRecord, CreatePaymentRecord, CreateWalletRecord, CreateWalletTransactionRecord, PaymentAuditEvent, PaymentRepository } from "../../src/features/payment/application/payment-repository";
import { PaymentService } from "../../src/features/payment/application/payment-service";
import { CustomerSnapshot, CustomerWalletEntity, CustomerWalletTransactionEntity, PaymentAllocationEntity, PaymentStatus, PaymentTransactionEntity, ReceivableEntity, TenantContext } from "../../src/features/payment/domain/payment-types";

const accounts: AccountSnapshot[] = [
  { id: "cash", businessId: "biz-1", code: "110101", name: "Kas", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "bank", businessId: "biz-1", code: "110102", name: "Bank", groupCode: 1, subtype: "bank", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "qris", businessId: "biz-1", code: "110401", name: "QRIS Clearing", groupCode: 1, subtype: "qris_clearing", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "float-settle", businessId: "biz-1", code: "110501", name: "Float Settlement", groupCode: 1, subtype: "float_settlement", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "wallet-liability", businessId: "biz-1", code: "210201", name: "Deposit Pelanggan", groupCode: 2, subtype: "customer_deposit", normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "revenue", businessId: "biz-1", code: "410101", name: "Pendapatan", groupCode: 4, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "ar", businessId: "biz-1", code: "110201", name: "Piutang", groupCode: 1, subtype: "accounts_receivable", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "adjustment", businessId: "biz-1", code: "610901", name: "Penyesuaian", groupCode: 6, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "other-cash", businessId: "biz-2", code: "110101", name: "Kas 2", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true }
];

class JR implements JournalRepository {
  posted: ValidatedJournal[] = [];
  async findAccountsForPosting(ctx: ATC, ids: string[]) { return accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async findOpenFiscalPeriod(ctx: ATC): Promise<FiscalPeriodSnapshot | null> { return { id: "period", businessId: ctx.businessId, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isClosed: false }; }
  async findPostedJournalByIdempotencyKey() { return null; }
  async createPostedJournal(_: ATC, journal: ValidatedJournal): Promise<PostedJournalResult> { this.posted.push(journal); return { journalId: "j" + this.posted.length, journalNumber: "JV-" + this.posted.length, postedAt: new Date(), totalDebit: journal.totalDebit, totalCredit: journal.totalCredit }; }
  async createAuditLog() {}
}

class Repo implements PaymentRepository {
  customers = new Map<string, CustomerSnapshot>();
  wallets = new Map<string, CustomerWalletEntity>();
  walletTransactions: CustomerWalletTransactionEntity[] = [];
  payments = new Map<string, PaymentTransactionEntity>();
  allocations: PaymentAllocationEntity[] = [];
  receivables = new Map<string, ReceivableEntity>();
  audits: PaymentAuditEvent[] = [];
  seq = 1;
  constructor() { this.customers.set("cust", { id: "cust", businessId: "biz-1", name: "Customer", isActive: true }); this.customers.set("other-cust", { id: "other-cust", businessId: "biz-2", name: "Other", isActive: true }); this.receivables.set("rec", { id: "rec", businessId: "biz-1", customerId: "cust", totalAmount: 100000n, paidAmount: 0n, status: "UNPAID", arAccountId: "ar" }); }
  async findAccounts(ctx: TenantContext, ids: string[]) { return accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async findCustomer(ctx: TenantContext, id: string) { const c = this.customers.get(id); return c?.businessId === ctx.businessId ? c : null; }
  async createCustomerWallet(ctx: TenantContext, input: CreateWalletRecord) { const w: CustomerWalletEntity = { id: "wallet" + this.seq++, businessId: ctx.businessId, customerId: input.customerId, depositLiabilityAccountId: input.depositLiabilityAccountId, currentBalance: input.openingBalance ?? 0n, isActive: true }; this.wallets.set(w.id, w); return w; }
  async findCustomerWallet(ctx: TenantContext, id: string) { const w = this.wallets.get(id); return w?.businessId === ctx.businessId ? w : null; }
  async findWalletByCustomer(ctx: TenantContext, customerId: string) { return [...this.wallets.values()].find((w) => w.businessId === ctx.businessId && w.customerId === customerId) ?? null; }
  async updateWalletBalance(ctx: TenantContext, id: string, balance: bigint) { const w = (await this.findCustomerWallet(ctx, id))!; const updated = { ...w, currentBalance: balance }; this.wallets.set(id, updated); return updated; }
  async createWalletTransaction(ctx: TenantContext, input: CreateWalletTransactionRecord) { const tx: CustomerWalletTransactionEntity = { id: "wtx" + this.seq++, businessId: ctx.businessId, walletId: input.walletId, customerId: input.customerId, type: input.type, transactionDate: input.transactionDate, amount: input.amount, balanceAfter: input.balanceAfter, description: input.description, postedJournalId: input.postedJournalId, createdByUserId: ctx.actorUserId }; this.walletTransactions.push(tx); return tx; }
  async listWalletTransactions(ctx: TenantContext, walletId: string) { return this.walletTransactions.filter((tx) => tx.businessId === ctx.businessId && tx.walletId === walletId); }
  async nextPaymentNumber() { return "PAY-" + this.seq++; }
  async createPayment(ctx: TenantContext, input: CreatePaymentRecord) { const p: PaymentTransactionEntity = { id: "pay" + this.seq++, businessId: ctx.businessId, paymentNumber: input.paymentNumber, customerId: input.customerId, transactionDate: input.transactionDate, totalAmount: input.totalAmount, allocatedAmount: 0n, status: "UNPAID", description: input.description, revenueSettlementAccountId: input.revenueSettlementAccountId, arAccountId: input.arAccountId ?? null, createdByUserId: ctx.actorUserId }; this.payments.set(p.id, p); return p; }
  async findPayment(ctx: TenantContext, id: string) { const p = this.payments.get(id); return p?.businessId === ctx.businessId ? p : null; }
  async updatePaymentAllocated(ctx: TenantContext, id: string, allocatedAmount: bigint, status: PaymentStatus) { const p = (await this.findPayment(ctx, id))!; const updated = { ...p, allocatedAmount, status }; this.payments.set(id, updated); return updated; }
  async listAllocations(ctx: TenantContext, id: string) { return this.allocations.filter((a) => a.businessId === ctx.businessId && a.paymentTransactionId === id); }
  async createAllocation(ctx: TenantContext, input: CreateAllocationRecord) { const a: PaymentAllocationEntity = { id: "alloc" + this.seq++, businessId: ctx.businessId, paymentTransactionId: input.paymentTransactionId, method: input.method, amount: input.amount, accountId: input.accountId ?? null, walletId: input.walletId ?? null, floatAccountId: input.floatAccountId ?? null, receivableId: input.receivableId ?? null, postedJournalId: input.postedJournalId }; this.allocations.push(a); return a; }
  async findReceivable(ctx: TenantContext, id: string) { const r = this.receivables.get(id); return r?.businessId === ctx.businessId ? r : null; }
  async updateReceivablePaid(ctx: TenantContext, id: string, paidAmount: bigint, status: PaymentStatus) { const r = (await this.findReceivable(ctx, id))!; const updated = { ...r, paidAmount, status }; this.receivables.set(id, updated); return updated; }
  async createAuditLog(_: TenantContext, e: PaymentAuditEvent) { this.audits.push(e); }
}

function setup() { const repo = new Repo(); const jr = new JR(); const service = new PaymentService(repo, new JournalPostingService(jr)); return { repo, jr, service }; }
const base = { businessId: "biz-1", actorUserId: "user", transactionDate: new Date("2026-05-30") };
async function wallet(service: PaymentService, openingBalance = 0n) { return service.createCustomerWallet({ businessId: "biz-1", actorUserId: "user", customerId: "cust", depositLiabilityAccountId: "wallet-liability", openingBalance }); }
async function payment(service: PaymentService, totalAmount = 100000n) { return service.createPayment({ ...base, customerId: "cust", totalAmount, description: "Sale", revenueSettlementAccountId: "revenue", arAccountId: "ar" }); }

describe("PaymentService", () => {
  it("posts wallet topup", async () => {
    const { jr, service } = setup(); const w = await wallet(service); const r = await service.topupWallet({ ...base, walletId: w.id, cashAccountId: "cash", amount: 50000n, description: "Deposit" });
    expect(r.transaction.balanceAfter).toBe(50000n); expect(jr.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["cash", "DEBIT"], ["wallet-liability", "CREDIT"]]);
  });
  it("posts wallet spending", async () => {
    const { jr, service } = setup(); const w = await wallet(service, 50000n); const r = await service.spendWallet({ ...base, walletId: w.id, revenueSettlementAccountId: "revenue", amount: 20000n, description: "Spend" });
    expect(r.transaction.balanceAfter).toBe(30000n); expect(jr.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["wallet-liability", "DEBIT"], ["revenue", "CREDIT"]]);
  });
  it("posts wallet refund", async () => {
    const { jr, service } = setup(); const w = await wallet(service, 50000n); const r = await service.refundWallet({ ...base, walletId: w.id, cashAccountId: "cash", amount: 10000n, description: "Refund" });
    expect(r.transaction.balanceAfter).toBe(40000n); expect(jr.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["wallet-liability", "DEBIT"], ["cash", "CREDIT"]]);
  });
  it("supports multi payment allocation", async () => {
    const { service } = setup(); const p = await payment(service); const result = await service.allocatePayment({ businessId: "biz-1", actorUserId: "user", paymentTransactionId: p.id, allocations: [{ method: "CASH", accountId: "cash", amount: 50000n }, { method: "QRIS", accountId: "qris", amount: 50000n }] });
    expect(result.payment.status).toBe("PAID"); expect(result.allocations).toHaveLength(2);
  });
  it("supports partial payment", async () => {
    const { service } = setup(); const p = await payment(service); const result = await service.allocatePayment({ businessId: "biz-1", actorUserId: "user", paymentTransactionId: p.id, allocations: [{ method: "CASH", accountId: "cash", amount: 30000n }] });
    expect(result.payment.status).toBe("PARTIALLY_PAID"); expect(result.payment.allocatedAmount).toBe(30000n);
  });
  it("supports installment payment", async () => {
    const { service } = setup(); const p = await payment(service); await service.allocatePayment({ businessId: "biz-1", actorUserId: "user", paymentTransactionId: p.id, allocations: [{ method: "CASH", accountId: "cash", amount: 30000n }] }); const result = await service.allocatePayment({ businessId: "biz-1", actorUserId: "user", paymentTransactionId: p.id, allocations: [{ method: "BANK", accountId: "bank", amount: 70000n }] });
    expect(result.payment.status).toBe("PAID"); expect(result.payment.allocatedAmount).toBe(100000n);
  });
  it("settles receivable", async () => {
    const { jr, service } = setup(); const r = await service.settleReceivable({ businessId: "biz-1", actorUserId: "user", receivableId: "rec", settlementDate: new Date("2026-05-30"), cashAccountId: "bank", amount: 100000n, description: "AR settlement" });
    expect(r.receivable.status).toBe("PAID"); expect(jr.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["bank", "DEBIT"], ["ar", "CREDIT"]]);
  });
  it("prevents overpayment", async () => {
    const { service } = setup(); const p = await payment(service, 100000n); await expect(service.allocatePayment({ businessId: "biz-1", actorUserId: "user", paymentTransactionId: p.id, allocations: [{ method: "CASH", accountId: "cash", amount: 100001n }] })).rejects.toThrow(/exceed|over/i);
  });
  it("prevents negative wallet balance", async () => {
    const { service } = setup(); const w = await wallet(service, 1000n); await expect(service.spendWallet({ ...base, walletId: w.id, revenueSettlementAccountId: "revenue", amount: 1001n, description: "Too much" })).rejects.toThrow(/negative/i);
  });
  it("isolates tenants", async () => {
    const { service } = setup(); await expect(service.createCustomerWallet({ businessId: "biz-1", actorUserId: "user", customerId: "other-cust", depositLiabilityAccountId: "wallet-liability" })).rejects.toThrow(/not found/i); const w = await wallet(service); await expect(service.getWalletBalance({ businessId: "biz-2", actorUserId: "user", walletId: w.id })).rejects.toThrow(/not found/i);
  });
});
