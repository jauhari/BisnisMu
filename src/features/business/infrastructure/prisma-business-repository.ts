import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { BusinessAuditEvent, BusinessRepository } from "../application/business-repository";
import { BeginningBalanceEntry, BeginningBalanceLine, BusinessEntity, CreateBusinessInput, FiscalPeriodEntity, TenantContext, UpdateBusinessSettingsInput } from "../domain/business-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaBusinessRepository implements BusinessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createBusiness(actorUserId: string, input: CreateBusinessInput & { name: string; currency: "IDR"; fiscalYearStart: number }): Promise<BusinessEntity> {
    const business = await this.prisma.business.create({ data: { name: input.name, type: input.type, npwpNumber: input.npwpNumber ?? null, address: input.address ?? null, fiscalYearStart: input.fiscalYearStart, currency: input.currency, settings: (input.settings ?? {}) as Prisma.InputJsonValue, createdByUserId: actorUserId } });
    return this.toBusiness(business);
  }

  async findBusiness(ctx: TenantContext): Promise<BusinessEntity | null> {
    const business = await this.prisma.business.findUnique({ where: { id: ctx.businessId } });
    return business ? this.toBusiness(business) : null;
  }

  async updateBusinessSettings(ctx: TenantContext, input: UpdateBusinessSettingsInput): Promise<BusinessEntity> {
    const data: Prisma.BusinessUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.npwpNumber !== undefined) data.npwpNumber = input.npwpNumber;
    if (input.address !== undefined) data.address = input.address;
    if (input.fiscalYearStart !== undefined) data.fiscalYearStart = input.fiscalYearStart;
    if (input.settings !== undefined) data.settings = input.settings as Prisma.InputJsonValue;
    const business = await this.prisma.business.update({ where: { id: ctx.businessId }, data });
    return this.toBusiness(business);
  }

  async findFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string): Promise<FiscalPeriodEntity | null> {
    const period = await this.prisma.fiscalPeriod.findFirst({ where: { businessId: ctx.businessId, id: fiscalPeriodId } });
    return period ? this.toPeriod(period) : null;
  }

  async findFiscalPeriodByYear(ctx: TenantContext, fiscalYear: number): Promise<FiscalPeriodEntity | null> {
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { businessId_fiscalYear: { businessId: ctx.businessId, fiscalYear } } });
    return period ? this.toPeriod(period) : null;
  }

  async createFiscalPeriod(ctx: TenantContext, input: { name: string; fiscalYear: number; startsOn: Date; endsOn: Date }): Promise<FiscalPeriodEntity> {
    const period = await this.prisma.fiscalPeriod.create({ data: { businessId: ctx.businessId, name: input.name, fiscalYear: input.fiscalYear, startsOn: input.startsOn, endsOn: input.endsOn, status: "OPEN", isClosed: false } });
    return this.toPeriod(period);
  }

  async closeFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string): Promise<FiscalPeriodEntity> {
    const period = await this.prisma.fiscalPeriod.update({ where: { id: fiscalPeriodId, businessId: ctx.businessId }, data: { status: "CLOSED", isClosed: true, closedAt: new Date(), closedByUserId: ctx.actorUserId } });
    return this.toPeriod(period);
  }

  async reopenFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string, reason: string): Promise<FiscalPeriodEntity> {
    const period = await this.prisma.fiscalPeriod.update({ where: { id: fiscalPeriodId, businessId: ctx.businessId }, data: { status: "OPEN", isClosed: false, reopenedAt: new Date(), reopenedByUserId: ctx.actorUserId, reopenReason: reason } });
    return this.toPeriod(period);
  }

  async findAccountsForBeginningBalance(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    const accounts = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return accounts.map((account) => ({ id: account.id, businessId: account.businessId, code: account.code, name: account.name, groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode, normalBalance: account.normalBalance, subtype: account.subtype, isPostingAllowed: account.isPostingAllowed, isActive: account.isActive }));
  }

  async saveBeginningBalances(ctx: TenantContext, fiscalPeriodId: string, lines: BeginningBalanceLine[]): Promise<BeginningBalanceEntry[]> {
    return this.prisma.$transaction(async (tx) => {
      const saved = [];
      for (const line of lines) {
        const row = await tx.beginningBalance.upsert({
          where: { businessId_accountId_fiscalPeriodId: { businessId: ctx.businessId, accountId: line.accountId, fiscalPeriodId } },
          create: { businessId: ctx.businessId, accountId: line.accountId, fiscalPeriodId, side: line.side, amount: line.amount, status: "DRAFT", createdByUserId: ctx.actorUserId },
          update: { side: line.side, amount: line.amount, status: "DRAFT", postedJournalId: null, postedByUserId: null, postedAt: null }
        });
        saved.push(this.toBeginningBalance(row));
      }
      return saved;
    });
  }

  async listBeginningBalances(ctx: TenantContext, fiscalPeriodId: string): Promise<BeginningBalanceEntry[]> {
    const rows = await this.prisma.beginningBalance.findMany({ where: { businessId: ctx.businessId, fiscalPeriodId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => this.toBeginningBalance(row));
  }

  async markBeginningBalancesPosted(ctx: TenantContext, fiscalPeriodId: string, journalId: string): Promise<void> {
    await this.prisma.beginningBalance.updateMany({ where: { businessId: ctx.businessId, fiscalPeriodId }, data: { status: "POSTED", postedJournalId: journalId, postedByUserId: ctx.actorUserId, postedAt: new Date() } });
  }

  async createAuditLog(ctx: TenantContext, event: BusinessAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action, entityType: event.entityType, entityId: event.entityId ?? null, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  private toBusiness(row: NonNullable<Awaited<ReturnType<PrismaClient["business"]["findUnique"]>>>): BusinessEntity {
    return { id: row.id, name: row.name, type: row.type, status: row.status, npwpNumber: row.npwpNumber, address: row.address, fiscalYearStart: row.fiscalYearStart, currency: "IDR", settings: row.settings as Record<string, unknown> | null, createdByUserId: row.createdByUserId, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }

  private toPeriod(row: NonNullable<Awaited<ReturnType<PrismaClient["fiscalPeriod"]["findFirst"]>>>): FiscalPeriodEntity {
    return { id: row.id, businessId: row.businessId, name: row.name, fiscalYear: row.fiscalYear, startsOn: row.startsOn, endsOn: row.endsOn, status: row.status, isClosed: row.isClosed, closedAt: row.closedAt, closedByUserId: row.closedByUserId, reopenedAt: row.reopenedAt, reopenedByUserId: row.reopenedByUserId, reopenReason: row.reopenReason };
  }

  private toBeginningBalance(row: NonNullable<Awaited<ReturnType<PrismaClient["beginningBalance"]["findFirst"]>>>): BeginningBalanceEntry {
    return { id: row.id, businessId: row.businessId, accountId: row.accountId, fiscalPeriodId: row.fiscalPeriodId, side: row.side, amount: row.amount, status: row.status, postedJournalId: row.postedJournalId };
  }
}
