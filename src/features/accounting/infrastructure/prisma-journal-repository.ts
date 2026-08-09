import { Prisma, PrismaClient } from "@prisma/client";
import { DbClient, isInTransaction, isRetryablePostgresError, withTransaction } from "../../shared/infrastructure/db-client";
import { AccountGroupCode, AccountSnapshot, FiscalPeriodSnapshot, JournalLineInput, TenantContext, ValidatedJournal } from "../domain/accounting-types";
import { JournalAuditEvent, JournalRepository, PostedJournalDetail, PostedJournalResult } from "../application/journal-repository";

const groupMap = {
  ASSET: 1,
  LIABILITY: 2,
  EQUITY: 3,
  REVENUE: 4,
  COGS: 5,
  EXPENSE: 6,
  OTHER_EXPENSE: 7
} as const;

export class PrismaJournalRepository implements JournalRepository {
  constructor(private readonly prisma: DbClient) {}

  async findAccountsForPosting(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    const accounts = await this.prisma.account.findMany({
      where: { businessId: ctx.businessId, id: { in: accountIds } }
    });

    return accounts.map((account) => ({
      id: account.id,
      businessId: account.businessId,
      code: account.code,
      name: account.name,
      groupCode: groupMap[account.groupCode] as AccountGroupCode,
      normalBalance: account.normalBalance,
      subtype: account.subtype,
      isPostingAllowed: account.isPostingAllowed,
      isActive: account.isActive
    }));
  }

  async findOpenFiscalPeriod(ctx: TenantContext, transactionDate: Date): Promise<FiscalPeriodSnapshot | null> {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        businessId: ctx.businessId,
        startsOn: { lte: transactionDate },
        endsOn: { gte: transactionDate },
        isClosed: false
      },
      orderBy: { startsOn: "desc" }
    });

    if (!period) return null;
    return { id: period.id, businessId: period.businessId, startsOn: period.startsOn, endsOn: period.endsOn, isClosed: period.isClosed };
  }

  async findPostedJournalByIdempotencyKey(ctx: TenantContext, idempotencyKey: string): Promise<PostedJournalResult | null> {
    const journal = await this.prisma.journalEntry.findUnique({
      where: { businessId_idempotencyKey: { businessId: ctx.businessId, idempotencyKey } }
    });

    if (!journal) return null;
    return { journalId: journal.id, journalNumber: journal.journalNumber, postedAt: journal.postedAt, totalDebit: journal.totalDebit, totalCredit: journal.totalCredit };
  }

  async findPostedJournalWithLines(ctx: TenantContext, journalId: string): Promise<PostedJournalDetail | null> {
    const journal = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, businessId: ctx.businessId },
      include: { lines: { orderBy: { lineNo: "asc" } } }
    });

    if (!journal) return null;
    return {
      journalId: journal.id,
      journalNumber: journal.journalNumber,
      postedAt: journal.postedAt,
      totalDebit: journal.totalDebit,
      totalCredit: journal.totalCredit,
      transactionDate: journal.transactionDate,
      source: journal.source,
      sourceId: journal.sourceId,
      description: journal.description,
      lines: journal.lines.map((line) => {
        const mapped: JournalLineInput = { accountId: line.accountId, side: line.side, amount: line.amount };
        if (line.memo !== null) mapped.memo = line.memo;
        return mapped;
      })
    };
  }

  async createPostedJournal(ctx: TenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> {
    // When the caller already opened a transaction, the write joins it and a retry here
    // would be pointless — the surrounding transaction is aborted on failure, and the
    // caller's own retry re-runs the whole unit of work.
    if (isInTransaction(this.prisma)) {
      return this.writeJournal(this.prisma as Prisma.TransactionClient, ctx, journal);
    }

    // Standalone posting owns its transaction, so it retries journal number collisions.
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return await withTransaction(this.prisma, (tx) => this.writeJournal(tx, ctx, journal), { timeout: 30000 });
      } catch (error) {
        if (isRetryablePostgresError(error) && attempt < 9) {
          await new Promise(r => setTimeout(r, Math.random() * 50 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Failed to generate unique journal number after 10 attempts.");
  }

  private async writeJournal(tx: Prisma.TransactionClient, ctx: TenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> {
    // Advisory lock serializes journal number generation per business. Held until the
    // enclosing transaction commits, whether that transaction is ours or the caller's.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.businessId + ":journal"}))`;

    const prefix = this.journalPrefix(journal.transactionDate);
    const latestRows = await tx.$queryRaw<Array<{ journal_number: string }>>`
      SELECT journal_number FROM journal_entries
      WHERE business_id = ${ctx.businessId}
        AND journal_number LIKE ${prefix + "%"}
      ORDER BY journal_number DESC
      LIMIT 1
    `;
    const latest = latestRows[0]?.journal_number;
    const nextSequence = latest ? Number(latest.slice(prefix.length)) + 1 : 1;
    const journalNumber = prefix + String(nextSequence).padStart(5, "0");

    const created = await tx.journalEntry.create({
      data: {
        businessId: ctx.businessId,
        fiscalPeriodId: journal.fiscalPeriod.id,
        journalNumber,
        transactionDate: journal.transactionDate,
        source: journal.source,
        sourceId: journal.sourceId ?? null,
        description: journal.description,
        totalDebit: journal.totalDebit,
        totalCredit: journal.totalCredit,
        postedByUserId: ctx.actorUserId,
        idempotencyKey: journal.idempotencyKey ?? null,
        lines: {
          create: journal.lines.map((line, index) => {
            const data: Prisma.JournalLineUncheckedCreateWithoutJournalInput = {
              businessId: ctx.businessId,
              accountId: line.accountId,
              side: line.side,
              amount: line.amount,
              lineNo: index + 1
            };
            if (line.memo !== undefined) data.memo = line.memo;
            return data;
          })
        }
      }
    });

    return { journalId: created.id, journalNumber: created.journalNumber, postedAt: created.postedAt, totalDebit: created.totalDebit, totalCredit: created.totalCredit };
  }

  async createAuditLog(ctx: TenantContext, event: JournalAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        metadata: event.metadata as Prisma.InputJsonValue,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null
      }
    });
  }

  private journalPrefix(transactionDate: Date): string {
    const year = transactionDate.getUTCFullYear();
    const month = String(transactionDate.getUTCMonth() + 1).padStart(2, "0");
    return "JV-" + year + month + "-";
  }
}
