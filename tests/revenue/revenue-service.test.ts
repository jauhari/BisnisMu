import { describe, expect, it } from "vitest";
import { JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import { AccountSnapshot, FiscalPeriodSnapshot, TenantContext as AccountingTenantContext, ValidatedJournal } from "../../src/features/accounting/domain/accounting-types";
import { RevenueAuditEvent, RevenueRepository } from "../../src/features/revenue/application/revenue-repository";
import { RevenueService } from "../../src/features/revenue/application/revenue-service";
import { CreateRevenueCategoryInput, CreateRevenueItemInput, CreateRevenuePackageInput, CreateRevenuePricingInput, RevenueCategory, RevenueDraftInput, RevenueItem, RevenuePackage, RevenuePricing, RevenueTransactionEntity, TenantContext } from "../../src/features/revenue/domain/revenue-types";

const accounts: AccountSnapshot[] = [
  { id: "cash", businessId: "biz-1", code: "110101", name: "Kas", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "ticketRevenue", businessId: "biz-1", code: "410401", name: "Pendapatan Tiket", groupCode: 4, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "parkingRevenue", businessId: "biz-1", code: "410402", name: "Pendapatan Parkir", groupCode: 4, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "tenant2cash", businessId: "biz-2", code: "110101", name: "Kas Tenant 2", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true }
];

class PostingRepo implements JournalRepository {
  posted: ValidatedJournal[] = [];
  async findAccountsForPosting(ctx: AccountingTenantContext, ids: string[]) { return accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async findOpenFiscalPeriod(ctx: AccountingTenantContext): Promise<FiscalPeriodSnapshot | null> { return { id: "period-1", businessId: ctx.businessId, startsOn: new Date("2026-01-01T00:00:00.000Z"), endsOn: new Date("2026-12-31T00:00:00.000Z"), isClosed: false }; }
  async findPostedJournalByIdempotencyKey() { return null; }
  async createPostedJournal(_ctx: AccountingTenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> { this.posted.push(journal); return { journalId: "journal-" + this.posted.length, journalNumber: "JV-" + this.posted.length, postedAt: new Date(), totalDebit: journal.totalDebit, totalCredit: journal.totalCredit }; }
  async createAuditLog() {}
}

class InMemoryRevenueRepository implements RevenueRepository {
  categories = new Map<string, RevenueCategory>();
  items = new Map<string, RevenueItem>();
  packages = new Map<string, RevenuePackage>();
  pricings = new Map<string, RevenuePricing>();
  transactions = new Map<string, RevenueTransactionEntity>();
  auditEvents: RevenueAuditEvent[] = [];
  private seq = 1;
  async findAccount(ctx: TenantContext, id: string) { return accounts.find((a) => a.businessId === ctx.businessId && a.id === id) ?? null; }
  async findCategory(ctx: TenantContext, id: string) { const v = this.categories.get(id); return v?.businessId === ctx.businessId ? v : null; }
  async findItem(ctx: TenantContext, id: string) { const v = this.items.get(id); return v?.businessId === ctx.businessId ? v : null; }
  async findPackage(ctx: TenantContext, id: string) { const v = this.packages.get(id); return v?.businessId === ctx.businessId ? v : null; }
  async findPricing(ctx: TenantContext, id: string) { const v = this.pricings.get(id); return v?.businessId === ctx.businessId ? v : null; }
  async listPricings(ctx: TenantContext, input: { itemId?: string; packageId?: string }) { return [...this.pricings.values()].filter((p) => p.businessId === ctx.businessId && p.isActive && ((!p.itemId && !input.itemId) || p.itemId === input.itemId) && ((!p.packageId && !input.packageId) || p.packageId === input.packageId)); }
  async createCategory(ctx: TenantContext, input: CreateRevenueCategoryInput) { const v: RevenueCategory = { id: "cat-" + this.seq++, businessId: ctx.businessId, name: input.name, type: input.type, revenueAccountId: input.revenueAccountId, description: input.description ?? null, isActive: true }; this.categories.set(v.id, v); return v; }
  async createItem(ctx: TenantContext, input: CreateRevenueItemInput) { const v: RevenueItem = { id: "item-" + this.seq++, businessId: ctx.businessId, categoryId: input.categoryId, name: input.name, sku: input.sku ?? null, description: input.description ?? null, isActive: true }; this.items.set(v.id, v); return v; }
  async createPackage(ctx: TenantContext, input: CreateRevenuePackageInput) { const v: RevenuePackage = { id: "pkg-" + this.seq++, businessId: ctx.businessId, categoryId: input.categoryId, name: input.name, description: input.description ?? null, isActive: true }; this.packages.set(v.id, v); return v; }
  async createPricing(ctx: TenantContext, input: CreateRevenuePricingInput) { const v: RevenuePricing = { id: "price-" + this.seq++, businessId: ctx.businessId, itemId: input.itemId ?? null, packageId: input.packageId ?? null, type: input.type, tierName: input.tierName ?? null, amount: input.amount, startsOn: input.startsOn ?? null, endsOn: input.endsOn ?? null, dayOfWeek: input.dayOfWeek ?? null, minQuantity: input.minQuantity ?? null, maxQuantity: input.maxQuantity ?? null, isActive: true }; this.pricings.set(v.id, v); return v; }
  async nextTransactionNumber() { return "REV-202605-" + String(this.seq++).padStart(5, "0"); }
  async createDraft(ctx: TenantContext, input: RevenueDraftInput & { unitPrice: bigint; amount: bigint; pricingId?: string | null }, number: string) { const tx: RevenueTransactionEntity = { id: "rev-" + this.seq++, businessId: ctx.businessId, transactionNumber: number, status: "DRAFT", type: input.type, transactionDate: input.transactionDate, categoryId: input.categoryId, itemId: input.itemId ?? null, packageId: input.packageId ?? null, pricingId: input.pricingId ?? null, cashAccountId: input.cashAccountId, quantity: input.quantity, unitPrice: input.unitPrice, amount: input.amount, description: input.description, contactId: input.contactId ?? null, createdByUserId: ctx.actorUserId }; this.transactions.set(tx.id, tx); return tx; }
  async findTransaction(ctx: TenantContext, id: string) { const v = this.transactions.get(id); return v?.businessId === ctx.businessId ? v : null; }
  async markPosted(ctx: TenantContext, id: string, journalId: string) { const tx = (await this.findTransaction(ctx, id))!; const v = { ...tx, status: "POSTED" as const, postedJournalId: journalId }; this.transactions.set(id, v); return v; }
  async markVoided(ctx: TenantContext, id: string, journalId: string, reason: string) { const tx = (await this.findTransaction(ctx, id))!; const v = { ...tx, status: "VOID" as const, voidJournalId: journalId, voidReason: reason }; this.transactions.set(id, v); return v; }
  async createAuditLog(_ctx: TenantContext, event: RevenueAuditEvent) { this.auditEvents.push(event); }
}

async function setup() {
  const repo = new InMemoryRevenueRepository();
  const postingRepo = new PostingRepo();
  const service = new RevenueService(repo, new JournalPostingService(postingRepo));
  const category = await service.createCategory({ businessId: "biz-1", actorUserId: "user-1", name: "Tiket", type: "TICKET", revenueAccountId: "ticketRevenue" });
  const item = await service.createItem({ businessId: "biz-1", actorUserId: "user-1", categoryId: category.id, name: "Tiket Masuk" });
  return { repo, postingRepo, service, category, item };
}

describe("RevenueService", () => {
  it("selects weekend pricing over standard pricing", async () => {
    const { service, category, item } = await setup();
    await service.createPricing({ businessId: "biz-1", actorUserId: "user-1", itemId: item.id, type: "STANDARD", amount: 100n });
    await service.createPricing({ businessId: "biz-1", actorUserId: "user-1", itemId: item.id, type: "WEEKEND", amount: 150n });
    const preview = await service.preview({ businessId: "biz-1", actorUserId: "user-1", type: "TICKET", transactionDate: new Date("2026-05-30T00:00:00.000Z"), categoryId: category.id, itemId: item.id, cashAccountId: "cash", quantity: 2, description: "Tiket weekend" });
    expect(preview.unitPrice).toBe(150n);
    expect(preview.amount).toBe(300n);
  });

  it("selects seasonal pricing over weekend pricing", async () => {
    const { service, category, item } = await setup();
    await service.createPricing({ businessId: "biz-1", actorUserId: "user-1", itemId: item.id, type: "WEEKEND", amount: 150n });
    await service.createPricing({ businessId: "biz-1", actorUserId: "user-1", itemId: item.id, type: "SEASONAL", amount: 200n, startsOn: new Date("2026-05-01T00:00:00.000Z"), endsOn: new Date("2026-06-30T00:00:00.000Z") });
    const preview = await service.preview({ businessId: "biz-1", actorUserId: "user-1", type: "TICKET", transactionDate: new Date("2026-05-30T00:00:00.000Z"), categoryId: category.id, itemId: item.id, cashAccountId: "cash", quantity: 1, description: "Tiket musim ramai" });
    expect(preview.unitPrice).toBe(200n);
  });

  it("posts revenue transaction with debit cash credit revenue", async () => {
    const { service, postingRepo, category, item } = await setup();
    await service.createPricing({ businessId: "biz-1", actorUserId: "user-1", itemId: item.id, type: "STANDARD", amount: 100n });
    const draft = await service.createDraft({ businessId: "biz-1", actorUserId: "user-1", type: "TICKET", transactionDate: new Date("2026-05-30T00:00:00.000Z"), categoryId: category.id, itemId: item.id, cashAccountId: "cash", quantity: 3, description: "Jual tiket" });
    const result = await service.post({ businessId: "biz-1", actorUserId: "user-1", transactionId: draft.id });
    expect(result.transaction.status).toBe("POSTED");
    expect(postingRepo.posted[0]?.lines.map((l) => [l.accountId, l.side, l.amount])).toEqual([["cash", "DEBIT", 300n], ["ticketRevenue", "CREDIT", 300n]]);
  });

  it("voids posted revenue with reversing journal", async () => {
    const { service, postingRepo, category, item } = await setup();
    await service.createPricing({ businessId: "biz-1", actorUserId: "user-1", itemId: item.id, type: "STANDARD", amount: 100n });
    const draft = await service.createDraft({ businessId: "biz-1", actorUserId: "user-1", type: "TICKET", transactionDate: new Date("2026-05-30T00:00:00.000Z"), categoryId: category.id, itemId: item.id, cashAccountId: "cash", quantity: 1, description: "Jual tiket" });
    await service.post({ businessId: "biz-1", actorUserId: "user-1", transactionId: draft.id });
    const voided = await service.void({ businessId: "biz-1", actorUserId: "user-1", transactionId: draft.id, reason: "Pembatalan transaksi" });
    expect(voided.transaction.status).toBe("VOID");
    expect(postingRepo.posted[1]?.lines.map((l) => [l.accountId, l.side, l.amount])).toEqual([["cash", "CREDIT", 100n], ["ticketRevenue", "DEBIT", 100n]]);
  });

  it("supports package pricing", async () => {
    const { service, category } = await setup();
    const pkg = await service.createPackage({ businessId: "biz-1", actorUserId: "user-1", categoryId: category.id, name: "Paket Keluarga" });
    await service.createPricing({ businessId: "biz-1", actorUserId: "user-1", packageId: pkg.id, type: "PACKAGE", amount: 450n });
    const preview = await service.preview({ businessId: "biz-1", actorUserId: "user-1", type: "TICKET", transactionDate: new Date("2026-05-29T00:00:00.000Z"), categoryId: category.id, packageId: pkg.id, cashAccountId: "cash", quantity: 1, description: "Paket" });
    expect(preview.amount).toBe(450n);
  });

  it("rejects cross-tenant cash account", async () => {
    const { service, category, item } = await setup();
    await expect(service.preview({ businessId: "biz-1", actorUserId: "user-1", type: "TICKET", transactionDate: new Date("2026-05-30T00:00:00.000Z"), categoryId: category.id, itemId: item.id, cashAccountId: "tenant2cash", quantity: 1, unitPrice: 100n, description: "Leak" })).rejects.toThrow(/cash account/i);
  });
});

