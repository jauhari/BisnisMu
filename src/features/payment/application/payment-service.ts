import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { PaymentEngine } from "../domain/payment-engine";
import { AllocatePaymentInput, PaymentAllocationInput, PaymentError, PaymentTransactionEntity, PaymentValidationContext, SettleReceivableInput, TenantContext, WalletMovementInput } from "../domain/payment-types";
import { AllocatePaymentCommand, CreateCustomerWalletCommand, CreatePaymentCommand, GetWalletBalanceCommand, PaymentRepository, SettleReceivableCommand, WalletAdjustmentCommand, WalletHistoryCommand, WalletRefundCommand, WalletSpendCommand, WalletTopupCommand } from "./payment-repository";

export class PaymentService {
  constructor(private readonly repo: PaymentRepository, private readonly journal: JournalPostingService, private readonly engine = new PaymentEngine()) {}

  async createCustomerWallet(command: CreateCustomerWalletCommand) {
    const ctx = this.ctx(command);
    const [customer, accounts] = await Promise.all([this.repo.findCustomer(ctx, command.customerId), this.repo.findAccounts(ctx, [command.depositLiabilityAccountId])]);
    this.engine.validateCreateWallet(command, { customer, depositLiabilityAccount: accounts[0] ?? null });
    const wallet = await this.repo.createCustomerWallet(ctx, command);
    await this.audit(ctx, "CUSTOMER_WALLET_CREATED", "customer_wallet", wallet.id, { customerId: wallet.customerId, openingBalance: wallet.currentBalance.toString() });
    return wallet;
  }

  async topupWallet(command: WalletTopupCommand) {
    const ctx = this.ctx(command);
    const validation = await this.walletContext(ctx, command, [command.cashAccountId]);
    const preview = this.engine.previewWalletTopup(command, validation);
    const posted = await this.post(ctx, command.transactionDate, "WALLET_TOPUP", command.walletId, command.description, preview.lines, "wallet-topup:" + ctx.businessId + ":" + command.walletId + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString() + ":" + command.description);
    const balanceAfter = this.engine.balanceAfterDebit(validation.wallet!, command.amount);
    await this.repo.updateWalletBalance(ctx, command.walletId, balanceAfter);
    const tx = await this.repo.createWalletTransaction(ctx, { ...command, type: "TOPUP", customerId: validation.wallet!.customerId, balanceAfter, postedJournalId: posted.journalId });
    await this.audit(ctx, "WALLET_TOPUP_POSTED", "wallet_transaction", tx.id, { journalId: posted.journalId, balanceAfter: balanceAfter.toString() });
    return { transaction: tx, journal: posted, preview };
  }

  async spendWallet(command: WalletSpendCommand) {
    const ctx = this.ctx(command);
    const validation = await this.walletContext(ctx, command, [command.revenueSettlementAccountId]);
    const preview = this.engine.previewWalletSpend(command, validation);
    const posted = await this.post(ctx, command.transactionDate, "WALLET_SPEND", command.walletId, command.description, preview.lines, "wallet-spend:" + ctx.businessId + ":" + command.walletId + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString() + ":" + command.description);
    const balanceAfter = this.engine.balanceAfterCredit(validation.wallet!, command.amount);
    await this.repo.updateWalletBalance(ctx, command.walletId, balanceAfter);
    const tx = await this.repo.createWalletTransaction(ctx, { ...command, type: "SPEND", customerId: validation.wallet!.customerId, balanceAfter, postedJournalId: posted.journalId });
    await this.audit(ctx, "WALLET_SPEND_POSTED", "wallet_transaction", tx.id, { journalId: posted.journalId, balanceAfter: balanceAfter.toString() });
    return { transaction: tx, journal: posted, preview };
  }

  async refundWallet(command: WalletRefundCommand) {
    const ctx = this.ctx(command);
    const validation = await this.walletContext(ctx, command, [command.cashAccountId]);
    const preview = this.engine.previewWalletRefund(command, validation);
    const posted = await this.post(ctx, command.transactionDate, "WALLET_REFUND", command.walletId, command.description, preview.lines, "wallet-refund:" + ctx.businessId + ":" + command.walletId + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString() + ":" + command.description);
    const balanceAfter = this.engine.balanceAfterCredit(validation.wallet!, command.amount);
    await this.repo.updateWalletBalance(ctx, command.walletId, balanceAfter);
    const tx = await this.repo.createWalletTransaction(ctx, { ...command, type: "REFUND", customerId: validation.wallet!.customerId, balanceAfter, postedJournalId: posted.journalId });
    await this.audit(ctx, "WALLET_REFUND_POSTED", "wallet_transaction", tx.id, { journalId: posted.journalId, balanceAfter: balanceAfter.toString() });
    return { transaction: tx, journal: posted, preview };
  }

  async adjustWallet(command: WalletAdjustmentCommand) {
    const ctx = this.ctx(command);
    const validation = await this.walletContext(ctx, command, [command.adjustmentAccountId]);
    const preview = this.engine.previewWalletAdjustment(command, validation);
    const posted = await this.post(ctx, command.transactionDate, "WALLET_ADJUSTMENT", command.walletId, command.description, preview.lines, "wallet-adjustment:" + ctx.businessId + ":" + command.walletId + ":" + command.direction + ":" + command.transactionDate.toISOString() + ":" + command.amount.toString());
    const balanceAfter = command.direction === "INCREASE" ? this.engine.balanceAfterDebit(validation.wallet!, command.amount) : this.engine.balanceAfterCredit(validation.wallet!, command.amount);
    await this.repo.updateWalletBalance(ctx, command.walletId, balanceAfter);
    const tx = await this.repo.createWalletTransaction(ctx, { ...command, type: "ADJUSTMENT", customerId: validation.wallet!.customerId, balanceAfter, postedJournalId: posted.journalId });
    await this.audit(ctx, "WALLET_ADJUSTMENT_POSTED", "wallet_transaction", tx.id, { journalId: posted.journalId, balanceAfter: balanceAfter.toString(), direction: command.direction });
    return { transaction: tx, journal: posted, preview };
  }

  async createPayment(command: CreatePaymentCommand) {
    const ctx = this.ctx(command);
    const [customer, accounts] = await Promise.all([this.repo.findCustomer(ctx, command.customerId), this.repo.findAccounts(ctx, [command.revenueSettlementAccountId, command.arAccountId].filter((id): id is string => Boolean(id)))]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    this.engine.validateCreatePayment(command, { customer, revenueSettlementAccount: byId.get(command.revenueSettlementAccountId) ?? null, arAccount: command.arAccountId ? byId.get(command.arAccountId) ?? null : null });
    const payment = await this.repo.createPayment(ctx, { ...command, paymentNumber: await this.repo.nextPaymentNumber(ctx, command.transactionDate) });
    await this.audit(ctx, "PAYMENT_CREATED", "payment_transaction", payment.id, { paymentNumber: payment.paymentNumber, totalAmount: payment.totalAmount.toString() });
    return payment;
  }

  async allocatePayment(command: AllocatePaymentCommand) {
    const ctx = this.ctx(command);
    const payment = await this.requirePayment(ctx, command.paymentTransactionId);
    const existing = await this.repo.listAllocations(ctx, payment.id);
    const results = [];
    const existingAllocated = existing.reduce((sum, allocation) => sum + allocation.amount, 0n);
    this.engine.validateAllocations(command, { payment }, existingAllocated);
    let runningAllocated = existingAllocated;
    for (const allocation of command.allocations) {
      const validation = await this.allocationContext(ctx, payment, [allocation]);
      this.engine.validateAllocations({ businessId: command.businessId, paymentTransactionId: command.paymentTransactionId, allocations: [allocation] }, validation, runningAllocated);
      const preview = this.engine.previewPaymentAllocation(payment, allocation, validation);
      const posted = await this.post(ctx, payment.transactionDate, "PAYMENT_" + allocation.method, payment.id, payment.description, preview.lines, "payment-allocation:" + ctx.businessId + ":" + payment.id + ":" + allocation.method + ":" + runningAllocated.toString() + ":" + allocation.amount.toString());
      if (allocation.method === "CUSTOMER_WALLET") await this.applyWalletSpendForAllocation(ctx, allocation, payment, posted.journalId);
      const created = await this.repo.createAllocation(ctx, { ...allocation, paymentTransactionId: payment.id, postedJournalId: posted.journalId });
      runningAllocated += allocation.amount;
      results.push({ allocation: created, journal: posted, preview });
    }
    const updated = await this.repo.updatePaymentAllocated(ctx, payment.id, runningAllocated, this.engine.nextPaymentStatus(payment.totalAmount, runningAllocated));
    await this.audit(ctx, "PAYMENT_ALLOCATED", "payment_transaction", payment.id, { allocatedAmount: runningAllocated.toString(), status: updated.status });
    return { payment: updated, allocations: results };
  }

  async settleReceivable(command: SettleReceivableCommand) {
    const ctx = this.ctx(command);
    const receivable = await this.repo.findReceivable(ctx, command.receivableId);
    const accountIds = [command.cashAccountId, receivable?.arAccountId].filter((id): id is string => Boolean(id));
    const accounts = await this.repo.findAccounts(ctx, accountIds);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const input: SettleReceivableInput = command;
    const preview = this.engine.previewReceivableSettlement(input, { receivable, cashAccount: byId.get(command.cashAccountId) ?? null, arAccount: receivable ? byId.get(receivable.arAccountId) ?? null : null });
    const posted = await this.post(ctx, command.settlementDate, "RECEIVABLE_SETTLEMENT", command.receivableId, command.description, preview.lines, "receivable-settlement:" + ctx.businessId + ":" + command.receivableId + ":" + command.settlementDate.toISOString() + ":" + command.amount.toString());
    const updated = await this.repo.updateReceivablePaid(ctx, command.receivableId, receivable!.paidAmount + command.amount, this.engine.nextReceivableStatus(receivable!, command.amount));
    await this.audit(ctx, "RECEIVABLE_SETTLED", "receivable_settlement", command.receivableId, { journalId: posted.journalId, paidAmount: updated.paidAmount.toString(), status: updated.status });
    return { receivable: updated, journal: posted, preview };
  }

  async getWalletBalance(command: GetWalletBalanceCommand): Promise<bigint> {
    const ctx = this.ctx(command);
    const wallet = await this.repo.findCustomerWallet(ctx, command.walletId);
    if (!wallet) throw new PaymentError("WALLET_NOT_FOUND", "Customer wallet was not found in this business.");
    return wallet.currentBalance;
  }

  async getWalletHistory(command: WalletHistoryCommand) { return this.repo.listWalletTransactions(this.ctx(command), command.walletId); }

  async listPayments(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }) {
    if (!this.repo.listPayments) throw new PaymentError("PAYMENT_LIST_UNAVAILABLE", "Payment listing is not available for this repository.");
    return this.repo.listPayments(this.ctx(command));
  }

  async listAllocations(command: { businessId: string; paymentTransactionId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }) {
    return this.repo.listAllocations(this.ctx(command), command.paymentTransactionId);
  }

  private async walletContext(ctx: TenantContext, input: WalletMovementInput, extraAccountIds: string[]): Promise<PaymentValidationContext> {
    const wallet = await this.repo.findCustomerWallet(ctx, input.walletId);
    const ids = [wallet?.depositLiabilityAccountId, ...extraAccountIds].filter((id): id is string => Boolean(id));
    const accounts = await this.repo.findAccounts(ctx, [...new Set(ids)]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return { wallet, depositLiabilityAccount: wallet ? byId.get(wallet.depositLiabilityAccountId) ?? null : null, cashAccount: input.cashAccountId ? byId.get(input.cashAccountId) ?? null : null, revenueSettlementAccount: input.revenueSettlementAccountId ? byId.get(input.revenueSettlementAccountId) ?? null : null, adjustmentAccount: input.adjustmentAccountId ? byId.get(input.adjustmentAccountId) ?? null : null };
  }

  private async allocationContext(ctx: TenantContext, payment: PaymentTransactionEntity, allocations: PaymentAllocationInput[]): Promise<PaymentValidationContext> {
    const first = allocations[0];
    const wallet = first?.walletId ? await this.repo.findCustomerWallet(ctx, first.walletId) : null;
    const receivable = first?.receivableId ? await this.repo.findReceivable(ctx, first.receivableId) : null;
    const accountIds = [payment.revenueSettlementAccountId, payment.arAccountId, wallet?.depositLiabilityAccountId, first?.accountId, receivable?.arAccountId].filter((id): id is string => Boolean(id));
    const accounts = await this.repo.findAccounts(ctx, [...new Set(accountIds)]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return { payment, wallet, receivable, depositLiabilityAccount: wallet ? byId.get(wallet.depositLiabilityAccountId) ?? null : null, cashAccount: first?.method === "CASH" || first?.method === "BANK" ? byId.get(first.accountId ?? "") ?? null : null, qrisClearingAccount: first?.method === "QRIS" ? byId.get(first.accountId ?? "") ?? null : null, floatSettlementAccount: first?.method === "FLOAT" ? byId.get(first.accountId ?? "") ?? null : null, revenueSettlementAccount: byId.get(payment.revenueSettlementAccountId) ?? null, arAccount: payment.arAccountId ? byId.get(payment.arAccountId) ?? null : receivable ? byId.get(receivable.arAccountId) ?? null : null };
  }

  private async applyWalletSpendForAllocation(ctx: TenantContext, allocation: PaymentAllocationInput, payment: PaymentTransactionEntity, postedJournalId: string): Promise<void> {
    const wallet = await this.repo.findCustomerWallet(ctx, allocation.walletId ?? "");
    if (!wallet) throw new PaymentError("WALLET_NOT_FOUND", "Customer wallet was not found in this business.");
    const balanceAfter = this.engine.balanceAfterCredit(wallet, allocation.amount);
    await this.repo.updateWalletBalance(ctx, wallet.id, balanceAfter);
    await this.repo.createWalletTransaction(ctx, { businessId: ctx.businessId, walletId: wallet.id, transactionDate: payment.transactionDate, amount: allocation.amount, description: "Payment " + payment.paymentNumber, type: "SPEND", customerId: wallet.customerId, balanceAfter, postedJournalId });
  }

  private async requirePayment(ctx: TenantContext, id: string) { const payment = await this.repo.findPayment(ctx, id); if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment transaction was not found in this business."); return payment; }
  private async post(ctx: TenantContext, date: Date, source: string, sourceId: string, description: string, lines: PostJournalCommand["lines"], idempotencyKey: string) { const cmd: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: date, source, sourceId, description: description.trim(), idempotencyKey, lines: lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) }; this.copyMeta(ctx, cmd); return this.journal.post(cmd); }
  private async audit(ctx: TenantContext, action: Parameters<PaymentRepository["createAuditLog"]>[1]["action"], entityType: Parameters<PaymentRepository["createAuditLog"]>[1]["entityType"], entityId: string, metadata: Record<string, unknown>) { await this.repo.createAuditLog(ctx, { action, businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType, entityId, metadata }); }
  private copyMeta(ctx: TenantContext, cmd: PostJournalCommand): void { if (ctx.requestId !== undefined) cmd.requestId = ctx.requestId; if (ctx.ipAddress !== undefined) cmd.ipAddress = ctx.ipAddress; if (ctx.userAgent !== undefined) cmd.userAgent = ctx.userAgent; }
  private ctx(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext { const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId }; if (command.requestId !== undefined) ctx.requestId = command.requestId; if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress; if (command.userAgent !== undefined) ctx.userAgent = command.userAgent; return ctx; }
}
