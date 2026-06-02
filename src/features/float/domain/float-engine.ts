import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreateFloatAccountInput, FloatAccountEntity, FloatAdjustmentInput, FloatConsumptionInput, FloatJournalPreview, FloatManagementError, FloatProvider, FloatTopupInput, FloatTransferInput, FloatValidationContext, JournalPreviewLine } from "./float-types";

const supportedProviders: FloatProvider[] = ["BUKUWARUNG", "FASTPAY", "PAYFAZZ", "SHOPEEPAY", "LINKAJA", "CUSTOM"];

export class FloatManagementEngine {
  validateCreateAccount(input: CreateFloatAccountInput, context: { floatAssetAccount: AccountSnapshot | null; offsetAccount: AccountSnapshot | null }): void {
    if (!input.businessId) throw new FloatManagementError("TENANT_REQUIRED", "businessId is required.");
    if (!supportedProviders.includes(input.provider)) throw new FloatManagementError("UNSUPPORTED_PROVIDER", "Float provider is not supported.", { provider: input.provider });
    if (!input.name.trim()) throw new FloatManagementError("FLOAT_ACCOUNT_NAME_REQUIRED", "Float account name is required.");
    if ((input.openingBalance ?? 0n) < 0n) throw new FloatManagementError("NEGATIVE_OPENING_BALANCE", "Opening balance cannot be negative.");
    this.assertAssetAccount(input.floatAssetAccountId, context.floatAssetAccount, input.businessId, "floatAssetAccountId");
    this.assertPostingAccount(input.offsetAccountId, context.offsetAccount, input.businessId, "offsetAccountId");
  }

  previewTopup(input: FloatTopupInput, context: FloatValidationContext): FloatJournalPreview {
    this.validateTopup(input, context);
    const offset = context.cashAccount ?? context.offsetAccount!;
    return this.preview(input.businessId, input.transactionDate, "TOPUP", input.description, [this.line(context.floatAssetAccount!, "DEBIT", input.amount), this.line(offset, "CREDIT", input.amount)]);
  }

  previewConsumption(input: FloatConsumptionInput, context: FloatValidationContext): FloatJournalPreview {
    this.validateConsumption(input, context);
    const offset = context.expenseAccount ?? context.offsetAccount!;
    const lines = [this.line(offset, "DEBIT", input.amount), this.line(context.floatAssetAccount!, "CREDIT", input.amount)];
    return this.preview(input.businessId, input.transactionDate, "CONSUME", input.description, lines);
  }

  previewTransfer(input: FloatTransferInput, context: FloatValidationContext): FloatJournalPreview {
    this.validateTransfer(input, context);
    return this.preview(input.businessId, input.transactionDate, "TRANSFER", input.description, [this.line(context.destinationFloatAssetAccount!, "DEBIT", input.amount), this.line(context.floatAssetAccount!, "CREDIT", input.amount)]);
  }

  previewAdjustment(input: FloatAdjustmentInput, context: FloatValidationContext): FloatJournalPreview {
    this.validateAdjustment(input, context);
    const offset = context.adjustmentAccount ?? context.offsetAccount!;
    const lines = input.direction === "INCREASE"
      ? [this.line(context.floatAssetAccount!, "DEBIT", input.amount), this.line(offset, "CREDIT", input.amount)]
      : [this.line(offset, "DEBIT", input.amount), this.line(context.floatAssetAccount!, "CREDIT", input.amount)];
    return this.preview(input.businessId, input.transactionDate, "ADJUSTMENT", input.description, lines);
  }

  balanceAfterDebit(account: FloatAccountEntity, amount: bigint): bigint {
    this.assertPositiveAmount(amount);
    return account.currentBalance + amount;
  }

  balanceAfterCredit(account: FloatAccountEntity, amount: bigint): bigint {
    this.assertPositiveAmount(amount);
    const next = account.currentBalance - amount;
    if (next < 0n) throw new FloatManagementError("NEGATIVE_FLOAT_BALANCE", "Float balance cannot become negative.", { floatAccountId: account.id, currentBalance: account.currentBalance.toString(), amount: amount.toString() });
    return next;
  }

  private validateTopup(input: FloatTopupInput, context: FloatValidationContext): void {
    this.validateBase(input.businessId, input.amount, input.description);
    this.assertFloatAccount(input.floatAccountId, context.floatAccount, input.businessId, "floatAccountId");
    this.assertAssetAccount(context.floatAccount!.floatAssetAccountId, context.floatAssetAccount ?? null, input.businessId, "floatAssetAccountId");
    if (input.cashAccountId) this.assertCashAccount(input.cashAccountId, context.cashAccount ?? null, input.businessId, "cashAccountId");
    else this.assertPostingAccount(context.floatAccount!.offsetAccountId, context.offsetAccount ?? null, input.businessId, "offsetAccountId");
  }

  private validateConsumption(input: FloatConsumptionInput, context: FloatValidationContext): void {
    this.validateBase(input.businessId, input.amount, input.description);
    this.assertFloatAccount(input.floatAccountId, context.floatAccount, input.businessId, "floatAccountId");
    this.assertAssetAccount(context.floatAccount!.floatAssetAccountId, context.floatAssetAccount ?? null, input.businessId, "floatAssetAccountId");
    this.balanceAfterCredit(context.floatAccount!, input.amount);
    if (input.expenseAccountId) this.assertPostingAccount(input.expenseAccountId, context.expenseAccount ?? null, input.businessId, "expenseAccountId");
    else this.assertPostingAccount(context.floatAccount!.offsetAccountId, context.offsetAccount ?? null, input.businessId, "offsetAccountId");
  }

  private validateTransfer(input: FloatTransferInput, context: FloatValidationContext): void {
    this.validateBase(input.businessId, input.amount, input.description);
    this.assertFloatAccount(input.floatAccountId, context.floatAccount, input.businessId, "floatAccountId");
    this.assertFloatAccount(input.destinationFloatAccountId, context.destinationFloatAccount ?? null, input.businessId, "destinationFloatAccountId");
    if (input.floatAccountId === input.destinationFloatAccountId) throw new FloatManagementError("TRANSFER_SAME_FLOAT", "Transfer source and destination floats must be different.");
    this.assertAssetAccount(context.floatAccount!.floatAssetAccountId, context.floatAssetAccount ?? null, input.businessId, "floatAssetAccountId");
    this.assertAssetAccount(context.destinationFloatAccount!.floatAssetAccountId, context.destinationFloatAssetAccount ?? null, input.businessId, "destinationFloatAssetAccountId");
    this.balanceAfterCredit(context.floatAccount!, input.amount);
  }

  private validateAdjustment(input: FloatAdjustmentInput, context: FloatValidationContext): void {
    this.validateBase(input.businessId, input.amount, input.description);
    this.assertFloatAccount(input.floatAccountId, context.floatAccount, input.businessId, "floatAccountId");
    this.assertAssetAccount(context.floatAccount!.floatAssetAccountId, context.floatAssetAccount ?? null, input.businessId, "floatAssetAccountId");
    if (input.direction === "DECREASE") this.balanceAfterCredit(context.floatAccount!, input.amount);
    if (input.adjustmentAccountId) this.assertPostingAccount(input.adjustmentAccountId, context.adjustmentAccount ?? null, input.businessId, "adjustmentAccountId");
    else this.assertPostingAccount(context.floatAccount!.offsetAccountId, context.offsetAccount ?? null, input.businessId, "offsetAccountId");
  }

  private validateBase(businessId: string, amount: bigint, description: string): void {
    if (!businessId) throw new FloatManagementError("TENANT_REQUIRED", "businessId is required.");
    this.assertPositiveAmount(amount);
    if (!description.trim()) throw new FloatManagementError("DESCRIPTION_REQUIRED", "Description is required.");
  }

  private assertPositiveAmount(amount: bigint): void {
    if (amount <= 0n) throw new FloatManagementError("INVALID_AMOUNT", "Float transaction amount must be greater than zero.");
  }

  private assertFloatAccount(accountId: string, account: FloatAccountEntity | null, businessId: string, field: string): void {
    if (!account) throw new FloatManagementError("FLOAT_ACCOUNT_NOT_FOUND", "Float account was not found in this business.", { accountId, field });
    if (account.businessId !== businessId) throw new FloatManagementError("TENANT_FLOAT_MISMATCH", "Float account must belong to the same business.", { accountId, field });
    if (!account.isActive) throw new FloatManagementError("FLOAT_ACCOUNT_INACTIVE", "Float account must be active.", { accountId, field });
  }

  private assertAssetAccount(accountId: string, account: AccountSnapshot | null, businessId: string, field: string): void {
    this.assertPostingAccount(accountId, account, businessId, field);
    if (!account || account.groupCode !== 1) throw new FloatManagementError("ACCOUNT_NOT_ASSET", "Float account must use an asset account.", { accountId, field });
  }

  private assertCashAccount(accountId: string, account: AccountSnapshot | null, businessId: string, field: string): void {
    this.assertAssetAccount(accountId, account, businessId, field);
    if (!account || (account.subtype !== undefined && account.subtype !== "cash" && account.subtype !== "bank")) throw new FloatManagementError("ACCOUNT_NOT_CASH_OR_BANK", "Cash account must be an active cash or bank account.", { accountId, field });
  }

  private assertPostingAccount(accountId: string, account: AccountSnapshot | null, businessId: string, field: string): void {
    if (!account) throw new FloatManagementError("ACCOUNT_NOT_FOUND", "Account was not found in this business.", { accountId, field });
    if (account.businessId !== businessId) throw new FloatManagementError("TENANT_ACCOUNT_MISMATCH", "Account must belong to the same business.", { accountId, field });
    if (!account.isActive || !account.isPostingAllowed) throw new FloatManagementError("ACCOUNT_NOT_POSTABLE", "Account must be active and posting-enabled.", { accountId, field });
  }

  private preview(businessId: string, transactionDate: Date, source: FloatJournalPreview["source"], description: string, lines: JournalPreviewLine[]): FloatJournalPreview {
    const totalDebit = lines.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + line.amount, 0n);
    const totalCredit = lines.filter((line) => line.side === "CREDIT").reduce((sum, line) => sum + line.amount, 0n);
    return { businessId, transactionDate, source, description, lines, totalDebit, totalCredit };
  }

  private line(account: AccountSnapshot, side: "DEBIT" | "CREDIT", amount: bigint): JournalPreviewLine {
    return { accountId: account.id, side, amount, accountCode: account.code, accountName: account.name };
  }
}
