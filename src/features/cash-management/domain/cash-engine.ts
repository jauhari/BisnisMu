import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CashManagementError, CashTransactionDraftInput, CashTransactionEntity, CashValidationContext, JournalPreview, JournalPreviewLine } from "./cash-types";

export class CashManagementEngine {
  validateDraft(input: CashTransactionDraftInput, context: CashValidationContext): void {
    if (!input.businessId) throw new CashManagementError("TENANT_REQUIRED", "businessId is required.");
    if (input.amount <= 0n) throw new CashManagementError("INVALID_AMOUNT", "Cash transaction amount must be greater than zero.");
    if (!input.description.trim()) throw new CashManagementError("DESCRIPTION_REQUIRED", "Description is required.");
    this.assertCashAccount(input.cashAccountId, context.cashAccount, input.businessId, "cashAccountId");

    if (context.contact && (!context.contact.isActive || context.contact.businessId !== input.businessId)) {
      throw new CashManagementError("CONTACT_NOT_AVAILABLE", "Contact must be active and belong to the same business.", { contactId: context.contact.id });
    }

    if (input.type === "TRANSFER") {
      if (!input.destinationAccountId) throw new CashManagementError("DESTINATION_ACCOUNT_REQUIRED", "Transfer requires a destination cash/bank account.");
      this.assertCashAccount(input.destinationAccountId, context.destinationAccount ?? null, input.businessId, "destinationAccountId");
      if (input.destinationAccountId === input.cashAccountId) throw new CashManagementError("TRANSFER_SAME_ACCOUNT", "Transfer source and destination accounts must be different.");
      if (input.categoryAccountId) throw new CashManagementError("TRANSFER_CATEGORY_NOT_ALLOWED", "Transfer must not use a category account.");
      return;
    }

    if (!input.categoryAccountId) throw new CashManagementError("CATEGORY_ACCOUNT_REQUIRED", "Cash in/out requires a category account.");
    this.assertPostingAccount(input.categoryAccountId, context.categoryAccount ?? null, input.businessId, "categoryAccountId");
  }

  preview(input: CashTransactionDraftInput, context: CashValidationContext): JournalPreview {
    this.validateDraft(input, context);
    const warnings = this.categoryWarnings(input, context.categoryAccount ?? null);
    const lines = this.linesFor(input, context);
    const totalDebit = lines.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + line.amount, 0n);
    const totalCredit = lines.filter((line) => line.side === "CREDIT").reduce((sum, line) => sum + line.amount, 0n);
    return { businessId: input.businessId, transactionDate: input.transactionDate, source: input.type, description: input.description, lines, totalDebit, totalCredit, warnings };
  }

  previewVoid(transaction: CashTransactionEntity, accounts: CashValidationContext): JournalPreview {
    if (transaction.status !== "POSTED") throw new CashManagementError("ONLY_POSTED_CAN_BE_VOIDED", "Only posted cash transactions can be voided.");
    const input = { businessId: transaction.businessId, type: transaction.type, transactionDate: transaction.transactionDate, cashAccountId: transaction.cashAccountId, amount: transaction.amount, description: transaction.description } as CashTransactionDraftInput;
    if (transaction.destinationAccountId !== null && transaction.destinationAccountId !== undefined) input.destinationAccountId = transaction.destinationAccountId;
    if (transaction.categoryAccountId !== null && transaction.categoryAccountId !== undefined) input.categoryAccountId = transaction.categoryAccountId;
    if (transaction.contactId !== null && transaction.contactId !== undefined) input.contactId = transaction.contactId;
    const original = this.preview(input, accounts);
    const lines = original.lines.map((line) => ({ ...line, side: line.side === "DEBIT" ? "CREDIT" as const : "DEBIT" as const }));
    return { ...original, source: "VOID_CASH_TRANSACTION", description: "Void: " + transaction.description, lines, totalDebit: original.totalCredit, totalCredit: original.totalDebit, warnings: [] };
  }

  private linesFor(input: CashTransactionDraftInput, context: CashValidationContext): JournalPreviewLine[] {
    const cash = context.cashAccount!;
    if (input.type === "CASH_IN") return [this.line(cash, "DEBIT", input.amount), this.line(context.categoryAccount!, "CREDIT", input.amount)];
    if (input.type === "CASH_OUT") return [this.line(context.categoryAccount!, "DEBIT", input.amount), this.line(cash, "CREDIT", input.amount)];
    return [this.line(context.destinationAccount!, "DEBIT", input.amount), this.line(cash, "CREDIT", input.amount)];
  }

  private line(account: AccountSnapshot, side: "DEBIT" | "CREDIT", amount: bigint): JournalPreviewLine {
    return { accountId: account.id, side, amount, accountCode: account.code, accountName: account.name };
  }

  private assertCashAccount(accountId: string, account: AccountSnapshot | null, businessId: string, field: string): void {
    this.assertPostingAccount(accountId, account, businessId, field);
    if (!account || account.groupCode !== 1 || (account.subtype !== undefined && account.subtype !== "cash" && account.subtype !== "bank")) {
      throw new CashManagementError("ACCOUNT_NOT_CASH_OR_BANK", "Account must be an active cash or bank account.", { accountId, field });
    }
  }

  private assertPostingAccount(accountId: string, account: AccountSnapshot | null, businessId: string, field: string): void {
    if (!account) throw new CashManagementError("ACCOUNT_NOT_FOUND", "Account was not found in this business.", { accountId, field });
    if (account.businessId !== businessId) throw new CashManagementError("TENANT_ACCOUNT_MISMATCH", "Account must belong to the same business.", { accountId, field });
    if (!account.isActive || !account.isPostingAllowed) throw new CashManagementError("ACCOUNT_NOT_POSTABLE", "Account must be active and posting-enabled.", { accountId, field });
  }

  private categoryWarnings(input: CashTransactionDraftInput, account: AccountSnapshot | null): string[] {
    if (!account) return [];
    if (input.type === "CASH_IN" && account.groupCode === 6) return ["Akun Beban biasanya digunakan untuk Kas Keluar. Pastikan transaksi ini benar."];
    if (input.type === "CASH_OUT" && account.groupCode === 4) return ["Akun Pendapatan biasanya digunakan untuk Kas Masuk. Pastikan transaksi ini benar."];
    return [];
  }
}

