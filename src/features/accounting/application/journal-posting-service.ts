import { AccountingEngine } from "../domain/accounting-engine";
import { AccountingError, TenantContext } from "../domain/accounting-types";
import { JournalRepository, PostJournalCommand, PostedJournalResult } from "./journal-repository";

export class JournalPostingService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly engine = new AccountingEngine()
  ) {}

  async post(command: PostJournalCommand): Promise<PostedJournalResult> {
    const ctx: TenantContext = {
      businessId: command.businessId,
      actorUserId: command.actorUserId
    };

    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;

    try {
      if (command.idempotencyKey) {
        const existing = await this.repository.findPostedJournalByIdempotencyKey(ctx, command.idempotencyKey);
        if (existing) return existing;
      }

      const accountIds = [...new Set(command.lines.map((line) => line.accountId))];
      const [accounts, fiscalPeriod] = await Promise.all([
        this.repository.findAccountsForPosting(ctx, accountIds),
        this.repository.findOpenFiscalPeriod(ctx, command.transactionDate)
      ]);

      if (!fiscalPeriod) {
        throw new AccountingError("FISCAL_PERIOD_NOT_FOUND", "No open fiscal period exists for the transaction date.", {
          transactionDate: command.transactionDate.toISOString()
        });
      }

      const journal = this.engine.validateJournal(command, accounts, fiscalPeriod);
      const result = await this.repository.createPostedJournal(ctx, journal);

      await this.repository.createAuditLog(ctx, {
        action: "JOURNAL_POSTED",
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        entityType: "journal",
        entityId: result.journalId,
        metadata: {
          journalNumber: result.journalNumber,
          source: journal.source,
          sourceId: journal.sourceId,
          totalDebit: result.totalDebit.toString(),
          totalCredit: result.totalCredit.toString(),
          idempotencyKey: journal.idempotencyKey
        }
      });

      return result;
    } catch (error) {
      await this.repository.createAuditLog(ctx, {
        action: "JOURNAL_POST_REJECTED",
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        entityType: "journal",
        metadata: {
          source: command.source,
          sourceId: command.sourceId,
          idempotencyKey: command.idempotencyKey,
          errorCode: error instanceof AccountingError ? error.code : "UNKNOWN_ERROR",
          errorMessage: error instanceof Error ? error.message : "Unknown error"
        }
      });

      throw error;
    }
  }
}

