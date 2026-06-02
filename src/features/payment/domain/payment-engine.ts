import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { AllocatePaymentInput, CreateCustomerWalletInput, CreatePaymentInput, CustomerWalletEntity, PaymentAllocationInput, PaymentError, PaymentJournalPreview, PaymentMethodType, PaymentStatus, PaymentTransactionEntity, PaymentValidationContext, ReceivableEntity, SettleReceivableInput, WalletMovementInput } from "./payment-types";

export class PaymentEngine {
  validateCreateWallet(input: CreateCustomerWalletInput, context: PaymentValidationContext): void {
    if (!input.businessId) throw new PaymentError("TENANT_REQUIRED", "businessId is required.");
    if ((input.openingBalance ?? 0n) < 0n) throw new PaymentError("NEGATIVE_OPENING_BALANCE", "Opening balance cannot be negative.");
    this.assertCustomer(input.customerId, context.customer ?? null, input.businessId);
    this.assertLiabilityAccount(input.depositLiabilityAccountId, context.depositLiabilityAccount ?? null, input.businessId, "depositLiabilityAccountId");
  }

  previewWalletTopup(input: WalletMovementInput, context: PaymentValidationContext): PaymentJournalPreview {
    this.validateWalletMovement(input, context);
    this.assertCashLike(input.cashAccountId ?? "", context.cashAccount ?? null, input.businessId, "cashAccountId");
    return this.preview(input.businessId, input.transactionDate, "WALLET_TOPUP", input.description, [this.line(context.cashAccount!, "DEBIT", input.amount), this.line(context.depositLiabilityAccount!, "CREDIT", input.amount)]);
  }

  previewWalletSpend(input: WalletMovementInput, context: PaymentValidationContext): PaymentJournalPreview {
    this.validateWalletMovement(input, context);
    this.assertRevenueSettlement(input.revenueSettlementAccountId ?? "", context.revenueSettlementAccount ?? null, input.businessId, "revenueSettlementAccountId");
    this.balanceAfterCredit(context.wallet!, input.amount);
    return this.preview(input.businessId, input.transactionDate, "WALLET_SPEND", input.description, [this.line(context.depositLiabilityAccount!, "DEBIT", input.amount), this.line(context.revenueSettlementAccount!, "CREDIT", input.amount)]);
  }

  previewWalletRefund(input: WalletMovementInput, context: PaymentValidationContext): PaymentJournalPreview {
    this.validateWalletMovement(input, context);
    this.assertCashLike(input.cashAccountId ?? "", context.cashAccount ?? null, input.businessId, "cashAccountId");
    this.balanceAfterCredit(context.wallet!, input.amount);
    return this.preview(input.businessId, input.transactionDate, "WALLET_REFUND", input.description, [this.line(context.depositLiabilityAccount!, "DEBIT", input.amount), this.line(context.cashAccount!, "CREDIT", input.amount)]);
  }

  previewWalletAdjustment(input: WalletMovementInput, context: PaymentValidationContext): PaymentJournalPreview {
    this.validateWalletMovement(input, context);
    if (input.direction !== "INCREASE" && input.direction !== "DECREASE") throw new PaymentError("ADJUSTMENT_DIRECTION_REQUIRED", "Wallet adjustment requires INCREASE or DECREASE direction.");
    this.assertPostingAccount(input.adjustmentAccountId ?? "", context.adjustmentAccount ?? null, input.businessId, "adjustmentAccountId");
    if (input.direction === "DECREASE") this.balanceAfterCredit(context.wallet!, input.amount);
    const lines = input.direction === "INCREASE" ? [this.line(context.adjustmentAccount!, "DEBIT", input.amount), this.line(context.depositLiabilityAccount!, "CREDIT", input.amount)] : [this.line(context.depositLiabilityAccount!, "DEBIT", input.amount), this.line(context.adjustmentAccount!, "CREDIT", input.amount)];
    return this.preview(input.businessId, input.transactionDate, "WALLET_ADJUSTMENT", input.description, lines);
  }

  validateCreatePayment(input: CreatePaymentInput, context: PaymentValidationContext): void {
    if (!input.businessId) throw new PaymentError("TENANT_REQUIRED", "businessId is required.");
    this.assertPositive(input.totalAmount);
    if (!input.description.trim()) throw new PaymentError("DESCRIPTION_REQUIRED", "Description is required.");
    this.assertCustomer(input.customerId, context.customer ?? null, input.businessId);
    this.assertRevenueSettlement(input.revenueSettlementAccountId, context.revenueSettlementAccount ?? null, input.businessId, "revenueSettlementAccountId");
    if (input.arAccountId) this.assertAssetAccount(input.arAccountId, context.arAccount ?? null, input.businessId, "arAccountId");
  }

  validateAllocations(input: AllocatePaymentInput, context: PaymentValidationContext, existingAllocated: bigint): void {
    const payment = context.payment;
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment transaction was not found in this business.");
    if (payment.businessId !== input.businessId) throw new PaymentError("TENANT_PAYMENT_MISMATCH", "Payment transaction must belong to the same business.");
    if (input.allocations.length === 0) throw new PaymentError("ALLOCATION_REQUIRED", "At least one payment allocation is required.");
    const amount = input.allocations.reduce((sum, allocation) => sum + allocation.amount, 0n);
    this.assertPositive(amount);
    if (existingAllocated + amount > payment.totalAmount) throw new PaymentError("OVER_ALLOCATION", "Payment allocations cannot exceed transaction total.", { totalAmount: payment.totalAmount.toString(), existingAllocated: existingAllocated.toString(), requestedAmount: amount.toString() });
  }

  previewPaymentAllocation(payment: PaymentTransactionEntity, allocation: PaymentAllocationInput, context: PaymentValidationContext): PaymentJournalPreview {
    const debit = this.debitAccountFor(allocation, context);
    const credit = allocation.method === "ACCOUNTS_RECEIVABLE" ? context.arAccount! : context.revenueSettlementAccount!;
    return this.preview(payment.businessId, payment.transactionDate, "PAYMENT_" + allocation.method, payment.description, [this.line(debit, "DEBIT", allocation.amount), this.line(credit, "CREDIT", allocation.amount)]);
  }

  previewReceivableSettlement(input: SettleReceivableInput, context: PaymentValidationContext): PaymentJournalPreview {
    this.assertPositive(input.amount);
    if (!input.description.trim()) throw new PaymentError("DESCRIPTION_REQUIRED", "Description is required.");
    const receivable = context.receivable;
    if (!receivable || receivable.businessId !== input.businessId) throw new PaymentError("RECEIVABLE_NOT_FOUND", "Receivable was not found in this business.");
    const remaining = receivable.totalAmount - receivable.paidAmount;
    if (input.amount > remaining) throw new PaymentError("OVERPAYMENT", "Receivable settlement cannot exceed outstanding balance.", { remaining: remaining.toString(), amount: input.amount.toString() });
    this.assertCashLike(input.cashAccountId, context.cashAccount ?? null, input.businessId, "cashAccountId");
    const settlementAccount = context.arAccount;
    this.assertPostingAccount(receivable.arAccountId, settlementAccount ?? null, input.businessId, "arAccountId");
    if (settlementAccount!.groupCode === 1) return this.preview(input.businessId, input.settlementDate, "RECEIVABLE_SETTLEMENT", input.description, [this.line(context.cashAccount!, "DEBIT", input.amount), this.line(settlementAccount!, "CREDIT", input.amount)]);
    if (settlementAccount!.groupCode === 2) return this.preview(input.businessId, input.settlementDate, "PAYABLE_SETTLEMENT", input.description, [this.line(settlementAccount!, "DEBIT", input.amount), this.line(context.cashAccount!, "CREDIT", input.amount)]);
    throw new PaymentError("INVALID_SETTLEMENT_ACCOUNT", "Settlement account must be accounts receivable or accounts payable.", { accountId: settlementAccount!.id });
  }

  nextPaymentStatus(total: bigint, allocated: bigint): PaymentStatus {
    if (allocated === 0n) return "UNPAID";
    if (allocated < total) return "PARTIALLY_PAID";
    if (allocated === total) return "PAID";
    throw new PaymentError("OVERPAYMENT", "Paid amount cannot exceed transaction total.");
  }

  nextReceivableStatus(receivable: ReceivableEntity, settlementAmount: bigint): PaymentStatus {
    return this.nextPaymentStatus(receivable.totalAmount, receivable.paidAmount + settlementAmount);
  }

  balanceAfterDebit(wallet: CustomerWalletEntity, amount: bigint): bigint { this.assertPositive(amount); return wallet.currentBalance + amount; }
  balanceAfterCredit(wallet: CustomerWalletEntity, amount: bigint): bigint { this.assertPositive(amount); const next = wallet.currentBalance - amount; if (next < 0n) throw new PaymentError("NEGATIVE_WALLET_BALANCE", "Customer wallet balance cannot become negative.", { walletId: wallet.id, currentBalance: wallet.currentBalance.toString(), amount: amount.toString() }); return next; }

  private validateWalletMovement(input: WalletMovementInput, context: PaymentValidationContext): void {
    if (!input.businessId) throw new PaymentError("TENANT_REQUIRED", "businessId is required.");
    this.assertPositive(input.amount);
    if (!input.description.trim()) throw new PaymentError("DESCRIPTION_REQUIRED", "Description is required.");
    const wallet = context.wallet;
    if (!wallet) throw new PaymentError("WALLET_NOT_FOUND", "Customer wallet was not found in this business.");
    if (wallet.businessId !== input.businessId) throw new PaymentError("TENANT_WALLET_MISMATCH", "Wallet must belong to the same business.");
    if (!wallet.isActive) throw new PaymentError("WALLET_INACTIVE", "Customer wallet must be active.");
    this.assertLiabilityAccount(wallet.depositLiabilityAccountId, context.depositLiabilityAccount ?? null, input.businessId, "depositLiabilityAccountId");
  }

  private validateAllocation(allocation: PaymentAllocationInput, payment: PaymentTransactionEntity, context: PaymentValidationContext): void {
    this.assertPositive(allocation.amount);
    if (allocation.method === "CASH" || allocation.method === "BANK") this.assertCashLike(allocation.accountId ?? "", context.cashAccount ?? null, payment.businessId, "accountId");
    if (allocation.method === "QRIS") this.assertAssetAccount(allocation.accountId ?? "", context.qrisClearingAccount ?? null, payment.businessId, "accountId");
    if (allocation.method === "FLOAT") this.assertAssetAccount(allocation.accountId ?? "", context.floatSettlementAccount ?? null, payment.businessId, "accountId");
    if (allocation.method === "CUSTOMER_WALLET") { if (!context.wallet || context.wallet.customerId !== payment.customerId) throw new PaymentError("CUSTOMER_WALLET_MISMATCH", "Wallet must belong to the payment customer."); this.balanceAfterCredit(context.wallet, allocation.amount); }
    if (allocation.method === "ACCOUNTS_RECEIVABLE") this.assertAssetAccount(payment.arAccountId ?? "", context.arAccount ?? null, payment.businessId, "arAccountId");
  }

  private debitAccountFor(allocation: PaymentAllocationInput, context: PaymentValidationContext): AccountSnapshot {
    if (allocation.method === "CUSTOMER_WALLET") return context.depositLiabilityAccount!;
    if (allocation.method === "ACCOUNTS_RECEIVABLE") return context.arAccount!;
    if (allocation.method === "QRIS") return context.qrisClearingAccount!;
    if (allocation.method === "FLOAT") return context.floatSettlementAccount!;
    return context.cashAccount!;
  }

  private assertCustomer(customerId: string, customer: PaymentValidationContext["customer"], businessId: string): void {
    if (!customer) throw new PaymentError("CUSTOMER_NOT_FOUND", "Customer was not found in this business.", { customerId });
    if (customer.businessId !== businessId) throw new PaymentError("TENANT_CUSTOMER_MISMATCH", "Customer must belong to the same business.", { customerId });
    if (!customer.isActive) throw new PaymentError("CUSTOMER_INACTIVE", "Customer must be active.", { customerId });
  }

  private assertPositive(amount: bigint): void { if (amount <= 0n) throw new PaymentError("INVALID_AMOUNT", "Amount must be greater than zero."); }
  private assertLiabilityAccount(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPostingAccount(id, account, businessId, field); if (!account || account.groupCode !== 2) throw new PaymentError("ACCOUNT_NOT_LIABILITY", "Account must be a liability account.", { accountId: id, field }); }
  private assertRevenueSettlement(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPostingAccount(id, account, businessId, field); if (!account || account.groupCode !== 4) throw new PaymentError("ACCOUNT_NOT_REVENUE", "Revenue settlement account must be a revenue account.", { accountId: id, field }); }
  private assertAssetAccount(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPostingAccount(id, account, businessId, field); if (!account || account.groupCode !== 1) throw new PaymentError("ACCOUNT_NOT_ASSET", "Account must be an asset account.", { accountId: id, field }); }
  private assertCashLike(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertAssetAccount(id, account, businessId, field); if (!account || (account.subtype !== "cash" && account.subtype !== "bank")) throw new PaymentError("ACCOUNT_NOT_CASH_OR_BANK", "Payment requires a cash or bank account.", { accountId: id, field }); }
  private assertPostingAccount(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { if (!account) throw new PaymentError("ACCOUNT_NOT_FOUND", "Account was not found in this business.", { accountId: id, field }); if (account.businessId !== businessId) throw new PaymentError("TENANT_ACCOUNT_MISMATCH", "Account must belong to the same business.", { accountId: id, field }); if (!account.isActive || !account.isPostingAllowed) throw new PaymentError("ACCOUNT_NOT_POSTABLE", "Account must be active and posting-enabled.", { accountId: id, field }); }

  private preview(businessId: string, transactionDate: Date, source: string, description: string, lines: PaymentJournalPreview["lines"]): PaymentJournalPreview { const totalDebit = lines.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + line.amount, 0n); const totalCredit = lines.filter((line) => line.side === "CREDIT").reduce((sum, line) => sum + line.amount, 0n); return { businessId, transactionDate, source, description, lines, totalDebit, totalCredit }; }
  private line(account: AccountSnapshot, side: "DEBIT" | "CREDIT", amount: bigint) { return { accountId: account.id, side, amount, accountCode: account.code, accountName: account.name }; }
}
