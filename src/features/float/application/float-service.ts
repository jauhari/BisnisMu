import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { FloatManagementEngine } from "../domain/float-engine";
import { CreateFloatAccountInput, FloatAdjustmentInput, FloatConsumptionInput, FloatManagementError, FloatTopupInput, FloatTransferInput, FloatValidationContext, TenantContext } from "../domain/float-types";
import { AdjustFloatCommand, ConsumeFloatCommand, CreateFloatAccountCommand, CreateFloatBalanceSnapshotCommand, FloatRepository, GetFloatBalanceCommand, TopupFloatCommand, TransferFloatCommand } from "./float-repository";

export class FloatManagementService {
  constructor(private readonly repository: FloatRepository, private readonly journalPostingService: JournalPostingService, private readonly engine = new FloatManagementEngine()) {}

  async createFloatAccount(command: CreateFloatAccountCommand) {
    const ctx = this.contextFrom(command);
    const accounts = await this.repository.findAccounts(ctx, [command.floatAssetAccountId, command.offsetAccountId]);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    this.engine.validateCreateAccount(command, { floatAssetAccount: byId.get(command.floatAssetAccountId) ?? null, offsetAccount: byId.get(command.offsetAccountId) ?? null });
    const account = await this.repository.createFloatAccount(ctx, command);
    await this.repository.createAuditLog(ctx, { action: "FLOAT_ACCOUNT_CREATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "float_account", entityId: account.id, metadata: { provider: account.provider, providerAccountId: account.providerAccountId, name: account.name } });
    return account;
  }

  async topupFloat(command: TopupFloatCommand) {
    const ctx = this.contextFrom(command);
    const input: FloatTopupInput = command;
    const validation = await this.validationContext(ctx, input, [command.cashAccountId]);
    const preview = this.engine.previewTopup(input, validation);
    const journal = await this.postJournal(ctx, input, "TOPUP", preview.lines, "float-topup:" + ctx.businessId + ":" + command.floatAccountId + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString() + ":" + (command.referenceNumber ?? command.description));
    const balanceAfter = this.engine.balanceAfterDebit(validation.floatAccount!, command.amount);
    await this.repository.updateFloatBalance(ctx, command.floatAccountId, balanceAfter);
    const record = { ...input, type: "TOPUP" as const, transactionNumber: await this.repository.nextTransactionNumber(ctx, command.transactionDate), balanceAfter, postedJournalId: journal.journalId };
    if (command.cashAccountId !== undefined) Object.assign(record, { cashAccountId: command.cashAccountId });
    const tx = await this.repository.createTransaction(ctx, record);
    await this.auditTransaction(ctx, "FLOAT_TOPUP_POSTED", tx.id, journal.journalId, tx.transactionNumber, balanceAfter);
    return { transaction: tx, journal, preview };
  }

  async consumeFloat(command: ConsumeFloatCommand) {
    const ctx = this.contextFrom(command);
    const input: FloatConsumptionInput = command;
    const validation = await this.validationContext(ctx, input, [command.expenseAccountId]);
    const preview = this.engine.previewConsumption(input, validation);
    const journal = await this.postJournal(ctx, input, "CONSUME", preview.lines, "float-consume:" + ctx.businessId + ":" + command.floatAccountId + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString() + ":" + (command.referenceNumber ?? command.description));
    const balanceAfter = this.engine.balanceAfterCredit(validation.floatAccount!, command.amount);
    await this.repository.updateFloatBalance(ctx, command.floatAccountId, balanceAfter);
    const tx = await this.repository.createTransaction(ctx, { ...input, type: "CONSUME", transactionNumber: await this.repository.nextTransactionNumber(ctx, command.transactionDate), balanceAfter, postedJournalId: journal.journalId });
    await this.auditTransaction(ctx, "FLOAT_CONSUMPTION_POSTED", tx.id, journal.journalId, tx.transactionNumber, balanceAfter);
    return { transaction: tx, journal, preview };
  }

  async transferFloat(command: TransferFloatCommand) {
    const ctx = this.contextFrom(command);
    const input: FloatTransferInput = command;
    const validation = await this.validationContext(ctx, input);
    const preview = this.engine.previewTransfer(input, validation);
    const journal = await this.postJournal(ctx, input, "TRANSFER", preview.lines, "float-transfer:" + ctx.businessId + ":" + command.floatAccountId + ":" + command.destinationFloatAccountId + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString() + ":" + (command.referenceNumber ?? command.description));
    const sourceBalanceAfter = this.engine.balanceAfterCredit(validation.floatAccount!, command.amount);
    const destinationBalanceAfter = this.engine.balanceAfterDebit(validation.destinationFloatAccount!, command.amount);
    await this.repository.updateFloatBalance(ctx, command.floatAccountId, sourceBalanceAfter);
    await this.repository.updateFloatBalance(ctx, command.destinationFloatAccountId, destinationBalanceAfter);
    const tx = await this.repository.createTransaction(ctx, { ...input, type: "TRANSFER", transactionNumber: await this.repository.nextTransactionNumber(ctx, command.transactionDate), balanceAfter: sourceBalanceAfter, postedJournalId: journal.journalId, destinationFloatAccountId: command.destinationFloatAccountId });
    await this.auditTransaction(ctx, "FLOAT_TRANSFER_POSTED", tx.id, journal.journalId, tx.transactionNumber, sourceBalanceAfter, { destinationFloatAccountId: command.destinationFloatAccountId, destinationBalanceAfter: destinationBalanceAfter.toString() });
    return { transaction: tx, journal, preview, destinationBalanceAfter };
  }

  async adjustFloat(command: AdjustFloatCommand) {
    const ctx = this.contextFrom(command);
    const input: FloatAdjustmentInput = command;
    const validation = await this.validationContext(ctx, input, [command.adjustmentAccountId]);
    const preview = this.engine.previewAdjustment(input, validation);
    const journal = await this.postJournal(ctx, input, "ADJUSTMENT", preview.lines, "float-adjustment:" + ctx.businessId + ":" + command.floatAccountId + ":" + command.direction + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString() + ":" + (command.referenceNumber ?? command.description));
    const balanceAfter = command.direction === "INCREASE" ? this.engine.balanceAfterDebit(validation.floatAccount!, command.amount) : this.engine.balanceAfterCredit(validation.floatAccount!, command.amount);
    await this.repository.updateFloatBalance(ctx, command.floatAccountId, balanceAfter);
    const tx = await this.repository.createTransaction(ctx, { ...input, type: "ADJUSTMENT", transactionNumber: await this.repository.nextTransactionNumber(ctx, command.transactionDate), balanceAfter, postedJournalId: journal.journalId });
    await this.auditTransaction(ctx, "FLOAT_ADJUSTMENT_POSTED", tx.id, journal.journalId, tx.transactionNumber, balanceAfter, { direction: command.direction });
    return { transaction: tx, journal, preview };
  }

  async getBalance(command: GetFloatBalanceCommand): Promise<bigint> {
    const ctx = this.contextFrom(command);
    const account = await this.repository.findFloatAccount(ctx, command.floatAccountId);
    if (!account) throw new FloatManagementError("FLOAT_ACCOUNT_NOT_FOUND", "Float account was not found in this business.", { floatAccountId: command.floatAccountId });
    return account.currentBalance;
  }

  async createBalanceSnapshot(command: CreateFloatBalanceSnapshotCommand) {
    const ctx = this.contextFrom(command);
    const account = await this.repository.findFloatAccount(ctx, command.floatAccountId);
    if (!account) throw new FloatManagementError("FLOAT_ACCOUNT_NOT_FOUND", "Float account was not found in this business.", { floatAccountId: command.floatAccountId });
    const snapshot = await this.repository.createBalanceSnapshot(ctx, command, account.currentBalance);
    await this.repository.createAuditLog(ctx, { action: "FLOAT_BALANCE_SNAPSHOT_CREATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "float_balance_snapshot", entityId: snapshot.id, metadata: { floatAccountId: account.id, snapshotDate: snapshot.snapshotDate.toISOString(), balance: snapshot.balance.toString() } });
    return snapshot;
  }

  private async validationContext(ctx: TenantContext, input: FloatTopupInput | FloatConsumptionInput | FloatTransferInput | FloatAdjustmentInput, extraAccountIds: Array<string | undefined> = []): Promise<FloatValidationContext> {
    const floatAccount = await this.repository.findFloatAccount(ctx, input.floatAccountId);
    const destinationFloatAccount = "destinationFloatAccountId" in input ? await this.repository.findFloatAccount(ctx, input.destinationFloatAccountId) : null;
    const accountIds = [floatAccount?.floatAssetAccountId, floatAccount?.offsetAccountId, destinationFloatAccount?.floatAssetAccountId, ...extraAccountIds].filter((id): id is string => Boolean(id));
    const accounts = await this.repository.findAccounts(ctx, [...new Set(accountIds)]);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    return { floatAccount, destinationFloatAccount, floatAssetAccount: floatAccount ? byId.get(floatAccount.floatAssetAccountId) ?? null : null, destinationFloatAssetAccount: destinationFloatAccount ? byId.get(destinationFloatAccount.floatAssetAccountId) ?? null : null, offsetAccount: floatAccount ? byId.get(floatAccount.offsetAccountId) ?? null : null, cashAccount: "cashAccountId" in input && input.cashAccountId ? byId.get(input.cashAccountId) ?? null : null, expenseAccount: "expenseAccountId" in input && input.expenseAccountId ? byId.get(input.expenseAccountId) ?? null : null, adjustmentAccount: "adjustmentAccountId" in input && input.adjustmentAccountId ? byId.get(input.adjustmentAccountId) ?? null : null };
  }

  private async postJournal(ctx: TenantContext, input: { transactionDate: Date; description: string; floatAccountId: string }, source: "TOPUP" | "CONSUME" | "TRANSFER" | "ADJUSTMENT", lines: PostJournalCommand["lines"], idempotencyKey: string) {
    const command: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: input.transactionDate, source: "FLOAT_" + source, sourceId: input.floatAccountId, description: input.description.trim(), idempotencyKey, lines: lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) };
    this.copyRequestMeta(ctx, command);
    return this.journalPostingService.post(command);
  }

  private async auditTransaction(ctx: TenantContext, action: "FLOAT_TOPUP_POSTED" | "FLOAT_CONSUMPTION_POSTED" | "FLOAT_TRANSFER_POSTED" | "FLOAT_ADJUSTMENT_POSTED", entityId: string, journalId: string, transactionNumber: string, balanceAfter: bigint, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.repository.createAuditLog(ctx, { action, businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "float_transaction", entityId, metadata: { journalId, transactionNumber, balanceAfter: balanceAfter.toString(), ...metadata } });
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
