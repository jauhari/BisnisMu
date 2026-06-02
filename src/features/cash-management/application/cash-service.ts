import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { CashManagementEngine } from "../domain/cash-engine";
import { CashManagementError, CashTransactionDraftInput, CashTransactionEntity, CashValidationContext, TenantContext } from "../domain/cash-types";
import { CashDraftCommand, CashRepository, CreateContactCommand, PostCashCommand, PreviewCashCommand, UpdateCashDraftCommand, VoidCashCommand } from "./cash-repository";

export class CashManagementService {
  constructor(private readonly repository: CashRepository, private readonly journalPostingService: JournalPostingService, private readonly engine = new CashManagementEngine()) {}

  async createContact(command: CreateContactCommand) {
    const ctx = this.contextFrom(command);
    if (!command.name.trim()) throw new CashManagementError("CONTACT_NAME_REQUIRED", "Contact name is required.");
    const contact = await this.repository.createContact(ctx, command);
    await this.repository.createAuditLog(ctx, { action: "CONTACT_CREATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "contact", entityId: contact.id, metadata: { name: contact.name, type: contact.type } });
    return contact;
  }

  async preview(command: PreviewCashCommand) {
    const ctx = this.contextFrom(command);
    const preview = this.engine.preview(command, await this.validationContext(ctx, command));
    await this.repository.createAuditLog(ctx, { action: "CASH_JOURNAL_PREVIEWED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "cash_transaction", metadata: { type: command.type, totalDebit: preview.totalDebit.toString(), totalCredit: preview.totalCredit.toString() } });
    return preview;
  }

  async createDraft(command: CashDraftCommand) {
    const ctx = this.contextFrom(command);
    this.engine.validateDraft(command, await this.validationContext(ctx, command));
    const transactionNumber = await this.repository.nextTransactionNumber(ctx, command.transactionDate);
    const draft = await this.repository.createDraft(ctx, command, transactionNumber);
    await this.repository.createAuditLog(ctx, { action: "CASH_TRANSACTION_DRAFTED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "cash_transaction", entityId: draft.id, metadata: { transactionNumber, type: draft.type, amount: draft.amount.toString() } });
    return draft;
  }

  async updateDraft(command: UpdateCashDraftCommand) {
    const ctx = this.contextFrom(command);
    const existing = await this.requireTransaction(ctx, command.transactionId);
    if (existing.status !== "DRAFT") throw new CashManagementError("ONLY_DRAFT_CAN_BE_UPDATED", "Only draft cash transactions can be updated.");
    this.engine.validateDraft(command, await this.validationContext(ctx, command));
    const updated = await this.repository.updateDraft(ctx, command.transactionId, command);
    await this.repository.createAuditLog(ctx, { action: "CASH_TRANSACTION_UPDATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "cash_transaction", entityId: updated.id, metadata: { transactionNumber: updated.transactionNumber } });
    return updated;
  }

  async post(command: PostCashCommand) {
    const ctx = this.contextFrom(command);
    const tx = await this.requireTransaction(ctx, command.transactionId);
    if (tx.status !== "DRAFT") throw new CashManagementError("ONLY_DRAFT_CAN_BE_POSTED", "Only draft cash transactions can be posted.");
    const input = this.inputFromTransaction(tx);
    const preview = this.engine.preview(input, await this.validationContext(ctx, input));
    const postCommand: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: tx.transactionDate, source: tx.type, sourceId: tx.id, description: tx.description, idempotencyKey: "cash:" + ctx.businessId + ":" + tx.id, lines: preview.lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) };
    this.copyRequestMeta(ctx, postCommand);
    const journal = await this.journalPostingService.post(postCommand);
    const posted = await this.repository.markPosted(ctx, tx.id, journal.journalId);
    await this.repository.createAuditLog(ctx, { action: "CASH_TRANSACTION_POSTED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "cash_transaction", entityId: posted.id, metadata: { journalId: journal.journalId, journalNumber: journal.journalNumber, transactionNumber: posted.transactionNumber } });
    return { transaction: posted, journal, preview };
  }

  async void(command: VoidCashCommand) {
    const ctx = this.contextFrom(command);
    if (command.reason.trim().length < 10) throw new CashManagementError("VOID_REASON_TOO_SHORT", "Void reason must be at least 10 characters.");
    const tx = await this.requireTransaction(ctx, command.transactionId);
    if (tx.status !== "POSTED") throw new CashManagementError("ONLY_POSTED_CAN_BE_VOIDED", "Only posted cash transactions can be voided.");
    const preview = this.engine.previewVoid(tx, await this.validationContext(ctx, this.inputFromTransaction(tx)));
    const postCommand: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: tx.transactionDate, source: "VOID_CASH_TRANSACTION", sourceId: tx.id, description: "Void " + tx.transactionNumber + ": " + command.reason.trim(), idempotencyKey: "void-cash:" + ctx.businessId + ":" + tx.id, lines: preview.lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) };
    this.copyRequestMeta(ctx, postCommand);
    const journal = await this.journalPostingService.post(postCommand);
    const voided = await this.repository.markVoided(ctx, tx.id, journal.journalId, command.reason.trim());
    await this.repository.createAuditLog(ctx, { action: "CASH_TRANSACTION_VOIDED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "cash_transaction", entityId: voided.id, metadata: { voidJournalId: journal.journalId, reason: command.reason.trim() } });
    return { transaction: voided, journal, preview };
  }

  private async validationContext(ctx: TenantContext, input: CashTransactionDraftInput): Promise<CashValidationContext> {
    const ids = [input.cashAccountId, input.destinationAccountId, input.categoryAccountId].filter((id): id is string => Boolean(id));
    const accounts = await this.repository.findAccounts(ctx, [...new Set(ids)]);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const contact = input.contactId ? await this.repository.findContact(ctx, input.contactId) : null;
    return { cashAccount: byId.get(input.cashAccountId) ?? null, destinationAccount: input.destinationAccountId ? byId.get(input.destinationAccountId) ?? null : null, categoryAccount: input.categoryAccountId ? byId.get(input.categoryAccountId) ?? null : null, contact };
  }

  private inputFromTransaction(tx: CashTransactionEntity): CashTransactionDraftInput {
    const input: CashTransactionDraftInput = { businessId: tx.businessId, type: tx.type, transactionDate: tx.transactionDate, cashAccountId: tx.cashAccountId, amount: tx.amount, description: tx.description, tags: tx.tags };
    if (tx.destinationAccountId !== null && tx.destinationAccountId !== undefined) input.destinationAccountId = tx.destinationAccountId;
    if (tx.categoryAccountId !== null && tx.categoryAccountId !== undefined) input.categoryAccountId = tx.categoryAccountId;
    if (tx.contactId !== null && tx.contactId !== undefined) input.contactId = tx.contactId;
    if (tx.paymentMethod !== null && tx.paymentMethod !== undefined) input.paymentMethod = tx.paymentMethod;
    if (tx.referenceNumber !== null && tx.referenceNumber !== undefined) input.referenceNumber = tx.referenceNumber;
    if (tx.attachmentKey !== null && tx.attachmentKey !== undefined) input.attachmentKey = tx.attachmentKey;
    return input;
  }

  private async requireTransaction(ctx: TenantContext, id: string): Promise<CashTransactionEntity> {
    const tx = await this.repository.findTransaction(ctx, id);
    if (!tx) throw new CashManagementError("CASH_TRANSACTION_NOT_FOUND", "Cash transaction was not found.", { transactionId: id });
    return tx;
  }

  private copyRequestMeta(ctx: TenantContext, command: PostJournalCommand): void {
    if (ctx.requestId !== undefined) command.requestId = ctx.requestId;
    if (ctx.ipAddress !== undefined) command.ipAddress = ctx.ipAddress;
    if (ctx.userAgent !== undefined) command.userAgent = ctx.userAgent;
  }

  private contextFrom(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext {
    const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;
    return ctx;
  }
}

