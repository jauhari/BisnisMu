import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode } from "../../accounting/domain/accounting-types";
import { FiscalPeriodEntity } from "../../business/domain/business-types";
import { LedgerRepository, ReportAuditEvent, ReportingRepository } from "../application/reporting-repository";
import { LedgerLineSource, ReportAccount, TenantContext } from "../domain/reporting-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaReportingRepository implements ReportingRepository, LedgerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string): Promise<FiscalPeriodEntity | null> {
    const period = await this.prisma.fiscalPeriod.findFirst({ where: { businessId: ctx.businessId, id: fiscalPeriodId } });
    if (!period) return null;
    return { id: period.id, businessId: period.businessId, name: period.name, fiscalYear: period.fiscalYear, startsOn: period.startsOn, endsOn: period.endsOn, status: period.status, isClosed: period.isClosed, closedAt: period.closedAt, closedByUserId: period.closedByUserId, reopenedAt: period.reopenedAt, reopenedByUserId: period.reopenedByUserId, reopenReason: period.reopenReason };
  }

  async createAuditLog(ctx: TenantContext, event: ReportAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action, entityType: event.entityType, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  async listAccounts(ctx: TenantContext): Promise<ReportAccount[]> {
    const accounts = await this.prisma.account.findMany({ where: { businessId: ctx.businessId }, orderBy: { code: "asc" } });
    return accounts.map((account) => ({ id: account.id, businessId: account.businessId, code: account.code, name: account.name, groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode, normalBalance: account.normalBalance, subtype: account.subtype, parentCode: account.parentCode, isActive: account.isActive }));
  }

  async listPostedLedgerLines(ctx: TenantContext, startsOn: Date, endsOn: Date): Promise<LedgerLineSource[]> {
    return this.queryLedgerLines(ctx, { gte: startsOn, lte: endsOn });
  }

  async listPostedLedgerLinesUntil(ctx: TenantContext, endsOn: Date): Promise<LedgerLineSource[]> {
    return this.queryLedgerLines(ctx, { lte: endsOn });
  }

  private async queryLedgerLines(ctx: TenantContext, dateFilter: { gte?: Date; lte: Date }): Promise<LedgerLineSource[]> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        businessId: ctx.businessId,
        journal: {
          businessId: ctx.businessId,
          status: "POSTED",
          transactionDate: dateFilter
        }
      },
      // Select only the columns the report mapping consumes instead of pulling
      // the entire parent journal + account rows for every line.
      select: {
        id: true,
        businessId: true,
        journalId: true,
        accountId: true,
        side: true,
        amount: true,
        lineNo: true,
        journal: { select: { journalNumber: true, transactionDate: true, description: true, source: true, sourceId: true } },
        account: { select: { code: true, name: true, groupCode: true, normalBalance: true } }
      },
      orderBy: [{ journal: { transactionDate: "asc" } }, { journal: { journalNumber: "asc" } }, { lineNo: "asc" }]
    });

    return lines.map((line) => ({
      id: line.id,
      businessId: line.businessId,
      journalId: line.journalId,
      journalNumber: line.journal.journalNumber,
      transactionDate: line.journal.transactionDate,
      accountId: line.accountId,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountGroupCode: domainGroupByPrisma[line.account.groupCode] as AccountGroupCode,
      accountNormalBalance: line.account.normalBalance,
      description: line.journal.description,
      source: line.journal.source,
      sourceId: line.journal.sourceId,
      side: line.side,
      amount: line.amount,
      lineNo: line.lineNo
    }));
  }
}

