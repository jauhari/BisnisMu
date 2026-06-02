import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CashAuditEvent, CashRepository } from "../application/cash-repository";
import {
  CashDrawerEntity,
  CashMovementEntity,
  CashMovementType,
  CashReconciliationEntity,
  CashSessionEntity,
  CloseSessionInput,
  OpenSessionInput,
  ReconcileCashInput,
  RecordCashMovementInput,
  TenantContext,
  TransferCashInput
} from "../domain/cash-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaCashSessionRepository implements CashRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    if (accountIds.length === 0) return [];
    const rows = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return rows.map((account) => ({
      id: account.id,
      businessId: account.businessId,
      code: account.code,
      name: account.name,
      groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode,
      normalBalance: account.normalBalance,
      subtype: account.subtype,
      isPostingAllowed: account.isPostingAllowed,
      isActive: account.isActive
    }));
  }

  async findDrawer(ctx: TenantContext, drawerId: string): Promise<CashDrawerEntity | null> {
    const row = await this.prisma.cashDrawer.findFirst({ where: { businessId: ctx.businessId, id: drawerId } });
    return row ? this.toDrawer(row) : null;
  }

  async findOpenSessionByDrawer(ctx: TenantContext, drawerId: string): Promise<CashSessionEntity | null> {
    const row = await this.prisma.cashSessionRecord.findFirst({
      where: { businessId: ctx.businessId, drawerId, status: "OPEN" }
    });
    return row ? this.toSession(row) : null;
  }

  async createSession(ctx: TenantContext, input: OpenSessionInput, cashAccountId: string): Promise<CashSessionEntity> {
    const row = await this.prisma.cashSessionRecord.create({
      data: {
        businessId: ctx.businessId,
        drawerId: input.drawerId,
        cashAccountId,
        status: "OPEN",
        openedAt: input.openedAt,
        openingAmount: input.openingAmount,
        expectedClosingAmount: input.openingAmount,
        openedByUserId: ctx.actorUserId,
        shiftCode: input.shiftCode ?? null
      }
    });
    return this.toSession(row);
  }

  async findSession(ctx: TenantContext, sessionId: string): Promise<CashSessionEntity | null> {
    const row = await this.prisma.cashSessionRecord.findFirst({
      where: { businessId: ctx.businessId, id: sessionId }
    });
    return row ? this.toSession(row) : null;
  }

  async updateSessionExpected(ctx: TenantContext, sessionId: string, expectedClosingAmount: bigint): Promise<CashSessionEntity> {
    const row = await this.prisma.cashSessionRecord.update({
      where: { id: sessionId },
      data: { expectedClosingAmount }
    });
    return this.toSession(row);
  }

  async closeSession(ctx: TenantContext, sessionId: string, input: CloseSessionInput, differenceAmount: bigint): Promise<CashSessionEntity> {
    const row = await this.prisma.cashSessionRecord.update({
      where: { id: sessionId },
      data: {
        status: "CLOSED",
        closedAt: input.closedAt,
        countedClosingAmount: input.countedAmount,
        differenceAmount,
        closedByUserId: ctx.actorUserId
      }
    });
    return this.toSession(row);
  }

  async createMovement(
    ctx: TenantContext,
    input: RecordCashMovementInput | TransferCashInput,
    type: CashMovementType,
    cashAccountId: string,
    amount: bigint,
    postedJournalId: string,
    destinationCashAccountId?: string | null
  ): Promise<CashMovementEntity> {
    const sessionId = "sessionId" in input ? input.sessionId : input.sessionId;
    const drawerId = "drawerId" in input ? (input as RecordCashMovementInput).drawerId : undefined;
    const movementDate = "movementDate" in input ? input.movementDate : new Date();
    const description = "description" in input ? input.description : "";

    const row = await this.prisma.cashMovementRecord.create({
      data: {
        businessId: ctx.businessId,
        sessionId: sessionId ?? null,
        drawerId: drawerId ?? null,
        type,
        movementDate,
        cashAccountId,
        destinationCashAccountId: destinationCashAccountId ?? null,
        amount,
        description,
        postedJournalId: postedJournalId || null,
        createdByUserId: ctx.actorUserId
      }
    });
    return this.toMovement(row);
  }

  async createReconciliation(
    ctx: TenantContext,
    input: ReconcileCashInput,
    expectedAmount: bigint,
    differenceAmount: bigint,
    postedJournalId?: string | null
  ): Promise<CashReconciliationEntity> {
    const row = await this.prisma.cashReconciliationRecord.create({
      data: {
        businessId: ctx.businessId,
        sessionId: input.sessionId,
        expectedAmount,
        countedAmount: input.countedAmount,
        differenceAmount,
        reconciledAt: input.reconciledAt,
        postedJournalId: postedJournalId ?? null,
        reconciledByUserId: ctx.actorUserId
      }
    });
    return this.toReconciliation(row);
  }

  async createAuditLog(ctx: TenantContext, event: CashAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        action: event.action as any,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        metadata: event.metadata as Prisma.InputJsonValue,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null
      }
    });
  }

  private toDrawer(row: any): CashDrawerEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      cashAccountId: row.cashAccountId,
      isActive: row.isActive
    };
  }

  private toSession(row: any): CashSessionEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      drawerId: row.drawerId,
      cashAccountId: row.cashAccountId,
      status: row.status,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      openingAmount: row.openingAmount,
      expectedClosingAmount: row.expectedClosingAmount,
      countedClosingAmount: row.countedClosingAmount,
      differenceAmount: row.differenceAmount,
      openedByUserId: row.openedByUserId,
      closedByUserId: row.closedByUserId,
      shiftCode: row.shiftCode
    };
  }

  private toMovement(row: any): CashMovementEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      sessionId: row.sessionId,
      drawerId: row.drawerId,
      type: row.type,
      movementDate: row.movementDate,
      cashAccountId: row.cashAccountId,
      destinationCashAccountId: row.destinationCashAccountId,
      amount: row.amount,
      description: row.description,
      postedJournalId: row.postedJournalId,
      createdByUserId: row.createdByUserId
    };
  }

  private toReconciliation(row: any): CashReconciliationEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      sessionId: row.sessionId,
      expectedAmount: row.expectedAmount,
      countedAmount: row.countedAmount,
      differenceAmount: row.differenceAmount,
      reconciledAt: row.reconciledAt,
      postedJournalId: row.postedJournalId,
      reconciledByUserId: row.reconciledByUserId
    };
  }
}
