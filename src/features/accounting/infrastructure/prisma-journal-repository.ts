import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot, FiscalPeriodSnapshot, TenantContext, ValidatedJournal } from "../domain/accounting-types";
import { JournalAuditEvent, JournalRepository, PostedJournalResult } from "../application/journal-repository";

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
  constructor(private readonly prisma: PrismaClient) {}

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

  async createPostedJournal(ctx: TenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> {
    // Retry loop to handle journal number collisions under concurrency
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Use advisory lock to serialize journal number generation per business
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
        }, { timeout: 30000 });
      } catch (error) {
        // Retry on unique constraint violation (P2002) or serialization failure (40001)
        const isRetryable = (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
          (error instanceof Error && error.message.includes("could not serialize")) ||
          (error instanceof Error && error.message.includes("deadlock")) ||
          (error instanceof Error && error.message.includes("Transaction already closed"));
        if (isRetryable && attempt < 9) {
          await new Promise(r => setTimeout(r, Math.random() * 50 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Failed to generate unique journal number after 10 attempts.");
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
