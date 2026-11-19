import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreateFloatTransactionRecord, FloatAuditEvent, FloatRepository } from "../application/float-repository";
import { CreateFloatAccountInput, FloatAccountEntity, FloatBalanceSnapshotEntity, FloatBalanceSnapshotInput, FloatTransactionEntity, TenantContext } from "../domain/float-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaFloatRepository implements FloatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    const accounts = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return accounts.map((account) => ({ id: account.id, businessId: account.businessId, code: account.code, name: account.name, groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode, normalBalance: account.normalBalance, subtype: account.subtype, isPostingAllowed: account.isPostingAllowed, isActive: account.isActive }));
  }

  async createFloatAccount(ctx: TenantContext, input: CreateFloatAccountInput): Promise<FloatAccountEntity> {
    const account = await this.prisma.floatAccount.create({ data: { businessId: ctx.businessId, provider: input.provider, providerAccountId: input.providerAccountId ?? null, name: input.name.trim(), floatAssetAccountId: input.floatAssetAccountId, offsetAccountId: input.offsetAccountId, currentBalance: input.openingBalance ?? 0n } });
    return this.toFloatAccount(account);
  }

  async findFloatAccount(ctx: TenantContext, floatAccountId: string): Promise<FloatAccountEntity | null> {
    const account = await this.prisma.floatAccount.findFirst({ where: { businessId: ctx.businessId, id: floatAccountId } });
    return account ? this.toFloatAccount(account) : null;
  }

  async nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string> {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const prefix = "FLOAT-" + y + m + "-";
    const latest = await this.prisma.floatTransaction.findFirst({ where: { businessId: ctx.businessId, transactionNumber: { startsWith: prefix } }, orderBy: { transactionNumber: "desc" } });
    const next = latest ? Number(latest.transactionNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async createTransaction(ctx: TenantContext, input: CreateFloatTransactionRecord): Promise<FloatTransactionEntity> {
    const tx = await this.prisma.floatTransaction.create({ data: { businessId: ctx.businessId, transactionNumber: input.transactionNumber, type: input.type, floatAccountId: input.floatAccountId, destinationFloatAccountId: input.destinationFloatAccountId ?? null, cashAccountId: input.cashAccountId ?? null, transactionDate: input.transactionDate, amount: input.amount, balanceAfter: input.balanceAfter, description: input.description.trim(), postedJournalId: input.postedJournalId, createdByUserId: ctx.actorUserId } });
    return this.toFloatTransaction(tx);
  }

  async incrementFloatBalance(ctx: TenantContext, floatAccountId: string, delta: bigint): Promise<bigint> {
    // Atomic in-SQL increment avoids the lost-update race of read-modify-write.
    const rows = await this.prisma.$queryRaw<Array<{ current_balance: bigint }>>`
      UPDATE float_accounts
      SET current_balance = current_balance + ${delta}, updated_at = ${new Date()}
      WHERE id = ${floatAccountId} AND business_id = ${ctx.businessId}
      RETURNING current_balance
    `;
    if (rows.length === 0) throw new Error("Float account not found for balance update.");
    return rows[0]!.current_balance;
  }

  async createBalanceSnapshot(ctx: TenantContext, input: FloatBalanceSnapshotInput, balance: bigint): Promise<FloatBalanceSnapshotEntity> {
    const snapshot = await this.prisma.floatBalanceSnapshot.upsert({ where: { businessId_floatAccountId_snapshotDate: { businessId: ctx.businessId, floatAccountId: input.floatAccountId, snapshotDate: input.snapshotDate } }, update: { balance }, create: { businessId: ctx.businessId, floatAccountId: input.floatAccountId, snapshotDate: input.snapshotDate, balance } });
    return this.toFloatSnapshot(snapshot);
  }

  async createAuditLog(ctx: TenantContext, event: FloatAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action, entityType: event.entityType, entityId: event.entityId ?? null, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  private toFloatAccount(row: NonNullable<Awaited<ReturnType<PrismaClient["floatAccount"]["findFirst"]>>>): FloatAccountEntity {
    return { id: row.id, businessId: row.businessId, provider: row.provider, providerAccountId: row.providerAccountId, name: row.name, floatAssetAccountId: row.floatAssetAccountId, offsetAccountId: row.offsetAccountId, currentBalance: row.currentBalance, isActive: row.isActive };
  }

  private toFloatTransaction(row: NonNullable<Awaited<ReturnType<PrismaClient["floatTransaction"]["findFirst"]>>>): FloatTransactionEntity {
    return { id: row.id, businessId: row.businessId, transactionNumber: row.transactionNumber, type: row.type, floatAccountId: row.floatAccountId, destinationFloatAccountId: row.destinationFloatAccountId, cashAccountId: row.cashAccountId, transactionDate: row.transactionDate, amount: row.amount, balanceAfter: row.balanceAfter, description: row.description, postedJournalId: row.postedJournalId, createdByUserId: row.createdByUserId };
  }

  private toFloatSnapshot(row: NonNullable<Awaited<ReturnType<PrismaClient["floatBalanceSnapshot"]["findFirst"]>>>): FloatBalanceSnapshotEntity {
    return { id: row.id, businessId: row.businessId, floatAccountId: row.floatAccountId, snapshotDate: row.snapshotDate, balance: row.balance };
  }
}
