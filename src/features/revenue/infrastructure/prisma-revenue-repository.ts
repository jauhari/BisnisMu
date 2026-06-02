import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { RevenueAuditEvent, RevenueRepository } from "../application/revenue-repository";
import { CreateRevenueCategoryInput, CreateRevenueItemInput, CreateRevenuePackageInput, CreateRevenuePricingInput, RevenueCategory, RevenueDraftInput, RevenueItem, RevenuePackage, RevenuePricing, RevenueTransactionEntity, TenantContext } from "../domain/revenue-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaRevenueRepository implements RevenueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccount(ctx: TenantContext, accountId: string): Promise<AccountSnapshot | null> {
    const a = await this.prisma.account.findFirst({ where: { businessId: ctx.businessId, id: accountId } });
    return a ? { id: a.id, businessId: a.businessId, code: a.code, name: a.name, groupCode: domainGroupByPrisma[a.groupCode] as AccountGroupCode, normalBalance: a.normalBalance, subtype: a.subtype, isPostingAllowed: a.isPostingAllowed, isActive: a.isActive } : null;
  }

  async findCategory(ctx: TenantContext, categoryId: string): Promise<RevenueCategory | null> { const row = await this.prisma.revenueCategory.findFirst({ where: { businessId: ctx.businessId, id: categoryId } }); return row ? this.toCategory(row) : null; }
  async findItem(ctx: TenantContext, itemId: string): Promise<RevenueItem | null> { const row = await this.prisma.revenueItem.findFirst({ where: { businessId: ctx.businessId, id: itemId } }); return row ? this.toItem(row) : null; }
  async findPackage(ctx: TenantContext, packageId: string): Promise<RevenuePackage | null> { const row = await this.prisma.revenuePackage.findFirst({ where: { businessId: ctx.businessId, id: packageId } }); return row ? this.toPackage(row) : null; }
  async findPricing(ctx: TenantContext, pricingId: string): Promise<RevenuePricing | null> { const row = await this.prisma.revenuePricing.findFirst({ where: { businessId: ctx.businessId, id: pricingId } }); return row ? this.toPricing(row) : null; }

  async listPricings(ctx: TenantContext, input: { itemId?: string; packageId?: string }): Promise<RevenuePricing[]> {
    const targets = [];
    if (input.itemId !== undefined) targets.push({ itemId: input.itemId });
    if (input.packageId !== undefined) targets.push({ packageId: input.packageId });
    if (targets.length === 0) return [];
    const rows = await this.prisma.revenuePricing.findMany({ where: { businessId: ctx.businessId, isActive: true, OR: targets } });
    return rows.map((row) => this.toPricing(row));
  }

  async createCategory(ctx: TenantContext, input: CreateRevenueCategoryInput): Promise<RevenueCategory> { const row = await this.prisma.revenueCategory.create({ data: { businessId: ctx.businessId, name: input.name.trim(), type: input.type, revenueAccountId: input.revenueAccountId, description: input.description ?? null } }); return this.toCategory(row); }
  async createItem(ctx: TenantContext, input: CreateRevenueItemInput): Promise<RevenueItem> { const row = await this.prisma.revenueItem.create({ data: { businessId: ctx.businessId, categoryId: input.categoryId, name: input.name.trim(), sku: input.sku ?? null, description: input.description ?? null } }); return this.toItem(row); }
  async createPackage(ctx: TenantContext, input: CreateRevenuePackageInput): Promise<RevenuePackage> { const row = await this.prisma.revenuePackage.create({ data: { businessId: ctx.businessId, categoryId: input.categoryId, name: input.name.trim(), description: input.description ?? null } }); return this.toPackage(row); }
  async createPricing(ctx: TenantContext, input: CreateRevenuePricingInput): Promise<RevenuePricing> { const row = await this.prisma.revenuePricing.create({ data: { businessId: ctx.businessId, itemId: input.itemId ?? null, packageId: input.packageId ?? null, type: input.type, tierName: input.tierName ?? null, amount: input.amount, startsOn: input.startsOn ?? null, endsOn: input.endsOn ?? null, dayOfWeek: input.dayOfWeek ?? null, minQuantity: input.minQuantity ?? null, maxQuantity: input.maxQuantity ?? null } }); return this.toPricing(row); }

  async nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "REV-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.revenueTransaction.findFirst({ where: { businessId: ctx.businessId, transactionNumber: { startsWith: prefix } }, orderBy: { transactionNumber: "desc" } });
    const next = latest ? Number(latest.transactionNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async createDraft(ctx: TenantContext, input: RevenueDraftInput & { unitPrice: bigint; amount: bigint; pricingId?: string | null }, transactionNumber: string): Promise<RevenueTransactionEntity> {
    const row = await this.prisma.revenueTransaction.create({ data: { businessId: ctx.businessId, transactionNumber, status: "DRAFT", type: input.type, transactionDate: input.transactionDate, categoryId: input.categoryId, itemId: input.itemId ?? null, packageId: input.packageId ?? null, pricingId: input.pricingId ?? null, cashAccountId: input.cashAccountId, quantity: input.quantity, unitPrice: input.unitPrice, amount: input.amount, description: input.description.trim(), contactId: input.contactId ?? null, createdByUserId: ctx.actorUserId } });
    return this.toTransaction(row);
  }

  async findTransaction(ctx: TenantContext, transactionId: string): Promise<RevenueTransactionEntity | null> { const row = await this.prisma.revenueTransaction.findFirst({ where: { businessId: ctx.businessId, id: transactionId } }); return row ? this.toTransaction(row) : null; }
  async markPosted(ctx: TenantContext, transactionId: string, journalId: string): Promise<RevenueTransactionEntity> { const row = await this.prisma.revenueTransaction.update({ where: { id: transactionId, businessId: ctx.businessId }, data: { status: "POSTED", postedJournalId: journalId, postedByUserId: ctx.actorUserId, postedAt: new Date() } }); return this.toTransaction(row); }
  async markVoided(ctx: TenantContext, transactionId: string, journalId: string, reason: string): Promise<RevenueTransactionEntity> { const row = await this.prisma.revenueTransaction.update({ where: { id: transactionId, businessId: ctx.businessId }, data: { status: "VOID", voidJournalId: journalId, voidReason: reason, voidedByUserId: ctx.actorUserId, voidedAt: new Date() } }); return this.toTransaction(row); }

  async createAuditLog(ctx: TenantContext, event: RevenueAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action, entityType: event.entityType, entityId: event.entityId ?? null, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  private toCategory(r: NonNullable<Awaited<ReturnType<PrismaClient["revenueCategory"]["findFirst"]>>>): RevenueCategory { return { id: r.id, businessId: r.businessId, name: r.name, type: r.type, revenueAccountId: r.revenueAccountId, description: r.description, isActive: r.isActive }; }
  private toItem(r: NonNullable<Awaited<ReturnType<PrismaClient["revenueItem"]["findFirst"]>>>): RevenueItem { return { id: r.id, businessId: r.businessId, categoryId: r.categoryId, name: r.name, sku: r.sku, description: r.description, isActive: r.isActive }; }
  private toPackage(r: NonNullable<Awaited<ReturnType<PrismaClient["revenuePackage"]["findFirst"]>>>): RevenuePackage { return { id: r.id, businessId: r.businessId, categoryId: r.categoryId, name: r.name, description: r.description, isActive: r.isActive }; }
  private toPricing(r: NonNullable<Awaited<ReturnType<PrismaClient["revenuePricing"]["findFirst"]>>>): RevenuePricing { return { id: r.id, businessId: r.businessId, itemId: r.itemId, packageId: r.packageId, type: r.type, tierName: r.tierName, amount: r.amount, startsOn: r.startsOn, endsOn: r.endsOn, dayOfWeek: r.dayOfWeek, minQuantity: r.minQuantity, maxQuantity: r.maxQuantity, isActive: r.isActive }; }
  private toTransaction(r: NonNullable<Awaited<ReturnType<PrismaClient["revenueTransaction"]["findFirst"]>>>): RevenueTransactionEntity { return { id: r.id, businessId: r.businessId, transactionNumber: r.transactionNumber, status: r.status, type: r.type, transactionDate: r.transactionDate, categoryId: r.categoryId, itemId: r.itemId, packageId: r.packageId, pricingId: r.pricingId, cashAccountId: r.cashAccountId, quantity: r.quantity, unitPrice: r.unitPrice, amount: r.amount, description: r.description, contactId: r.contactId, postedJournalId: r.postedJournalId, voidJournalId: r.voidJournalId, voidReason: r.voidReason, createdByUserId: r.createdByUserId }; }
}

