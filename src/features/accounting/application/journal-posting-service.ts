import { AccountingEngine } from "../domain/accounting-engine";
import { AccountingError, TenantContext } from "../domain/accounting-types";
import { JournalRepository, PostJournalCommand, PostedJournalResult } from "./journal-repository";
import type { TxClient } from "../../shared/tx";

export class JournalPostingService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly engine = new AccountingEngine()
  ) {}

  async post(command: PostJournalCommand, tx?: TxClient): Promise<PostedJournalResult> {
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
      const result = await this.repository.createPostedJournal(ctx, journal, tx);

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
      // Best-effort audit; must never mask the original posting error.
      try {
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
      } catch (auditError) {
        console.error("[journal-posting] failed to write rejection audit log", auditError);
      }

      throw error;
    }
  }

  async replacePosted(journalId: string, command: PostJournalCommand): Promise<PostedJournalResult> {
    if (!this.repository.replacePostedJournal) throw new AccountingError("JOURNAL_REPLACE_UNSUPPORTED", "Journal replacement is not supported by this repository.");
    const ctx: TenantContext = {
      businessId: command.businessId,
      actorUserId: command.actorUserId
    };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;

    const accountIds = [...new Set(command.lines.map((line) => line.accountId))];
    const [accounts, fiscalPeriod] = await Promise.all([
      this.repository.findAccountsForPosting(ctx, accountIds),
      this.repository.findOpenFiscalPeriod(ctx, command.transactionDate)
    ]);
    if (!fiscalPeriod) throw new AccountingError("FISCAL_PERIOD_NOT_FOUND", "No open fiscal period exists for the transaction date.", { transactionDate: command.transactionDate.toISOString() });
    const journal = this.engine.validateJournal(command, accounts, fiscalPeriod);
    const result = await this.repository.replacePostedJournal(ctx, journalId, journal);
    await this.repository.createAuditLog(ctx, {
      action: "JOURNAL_UPDATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "journal",
      entityId: result.journalId,
      metadata: { source: journal.source, sourceId: journal.sourceId, totalDebit: result.totalDebit.toString(), totalCredit: result.totalCredit.toString(), hardEdit: true }
    });
    return result;
  }

  async deletePosted(command: { businessId: string; actorUserId: string; journalId: string; requestId?: string; ipAddress?: string; userAgent?: string }): Promise<boolean> {
    if (!this.repository.deletePostedJournal) throw new AccountingError("JOURNAL_DELETE_UNSUPPORTED", "Journal deletion is not supported by this repository.");
    const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;
    const deleted = await this.repository.deletePostedJournal(ctx, command.journalId);
    if (deleted) {
      await this.repository.createAuditLog(ctx, { action: "JOURNAL_UPDATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "journal", entityId: command.journalId, metadata: { hardDelete: true } });
    }
    return deleted;
  }
}

