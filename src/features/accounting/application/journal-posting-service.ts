import { AccountingEngine } from "../domain/accounting-engine";
import { AccountingError, JournalLineInput, TenantContext } from "../domain/accounting-types";
import { JournalRepository, PostJournalCommand, PostedJournalResult, ReverseJournalCommand } from "./journal-repository";

/** Idempotency key for the reversal of a given journal. One reversal per source journal. */
export function reversalIdempotencyKey(businessId: string, journalId: string): string {
  return "reversal:" + businessId + ":" + journalId;
}

function flip(line: JournalLineInput): JournalLineInput {
  const reversed: JournalLineInput = {
    accountId: line.accountId,
    side: line.side === "DEBIT" ? "CREDIT" : "DEBIT",
    amount: line.amount
  };
  if (line.memo !== undefined) reversed.memo = line.memo;
  return reversed;
}

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

  /**
   * Posts the mirror image of an already-posted journal: every DEBIT becomes a CREDIT
   * and vice versa, at the same amounts and accounts. The result is balanced by
   * construction, and is idempotent per source journal — calling it twice returns the
   * reversal that already exists rather than double-reversing.
   */
  async reverse(command: ReverseJournalCommand): Promise<PostedJournalResult> {
    const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;

    const idempotencyKey = reversalIdempotencyKey(ctx.businessId, command.journalId);
    const alreadyReversed = await this.repository.findPostedJournalByIdempotencyKey(ctx, idempotencyKey);
    if (alreadyReversed) return alreadyReversed;

    const source = await this.repository.findPostedJournalWithLines(ctx, command.journalId);
    if (!source) {
      throw new AccountingError("JOURNAL_NOT_FOUND", "Journal to reverse was not found in this business.", {
        journalId: command.journalId
      });
    }

    const reversalCommand: PostJournalCommand = {
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      transactionDate: command.reversalDate ?? source.transactionDate,
      source: "REVERSAL_" + source.source,
      sourceId: source.sourceId ?? command.journalId,
      description: "Reversal of " + source.journalNumber + ": " + command.reason,
      idempotencyKey,
      lines: source.lines.map(flip)
    };
    if (ctx.requestId !== undefined) reversalCommand.requestId = ctx.requestId;
    if (ctx.ipAddress !== undefined) reversalCommand.ipAddress = ctx.ipAddress;
    if (ctx.userAgent !== undefined) reversalCommand.userAgent = ctx.userAgent;

    const posted = await this.post(reversalCommand);

    await this.repository.createAuditLog(ctx, {
      action: "JOURNAL_REVERSED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "journal",
      entityId: posted.journalId,
      metadata: {
        reversedJournalId: command.journalId,
        reversedJournalNumber: source.journalNumber,
        reversalJournalNumber: posted.journalNumber,
        reason: command.reason
      }
    });

    return posted;
  }
}

