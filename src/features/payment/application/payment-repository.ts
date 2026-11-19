import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CustomerSnapshot, CustomerWalletEntity, CustomerWalletTransactionEntity, PaymentAllocationEntity, PaymentAllocationInput, PaymentStatus, PaymentTransactionEntity, ReceivableEntity, TenantContext, WalletMovementInput } from "../domain/payment-types";

export interface PaymentAuditEvent {
  action: "CUSTOMER_WALLET_CREATED" | "WALLET_TOPUP_POSTED" | "WALLET_SPEND_POSTED" | "WALLET_REFUND_POSTED" | "WALLET_ADJUSTMENT_POSTED" | "PAYMENT_CREATED" | "PAYMENT_ALLOCATED" | "RECEIVABLE_SETTLED";
  businessId: string;
  actorUserId: string;
  entityType: "customer_wallet" | "wallet_transaction" | "payment_transaction" | "payment_allocation" | "receivable_settlement";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface CreateWalletRecord { businessId: string; customerId: string; depositLiabilityAccountId: string; openingBalance?: bigint; }
export interface CreateWalletTransactionRecord extends WalletMovementInput { type: "TOPUP" | "SPEND" | "REFUND" | "ADJUSTMENT"; customerId: string; balanceAfter: bigint; postedJournalId: string; }
export interface CreatePaymentRecord { businessId: string; customerId: string; transactionDate: Date; totalAmount: bigint; description: string; revenueSettlementAccountId: string; arAccountId?: string; paymentNumber: string; }
export interface CreateAllocationRecord extends PaymentAllocationInput { paymentTransactionId: string; postedJournalId: string; }

export interface PaymentRepository {
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  findCustomer(ctx: TenantContext, customerId: string): Promise<CustomerSnapshot | null>;
  createCustomerWallet(ctx: TenantContext, input: CreateWalletRecord): Promise<CustomerWalletEntity>;
  findCustomerWallet(ctx: TenantContext, walletId: string): Promise<CustomerWalletEntity | null>;
  findWalletByCustomer(ctx: TenantContext, customerId: string): Promise<CustomerWalletEntity | null>;
  /**
   * Atomically applies a signed delta to the wallet balance and returns the
   * resulting balance, preventing lost updates under concurrent movements.
   */
  incrementWalletBalance(ctx: TenantContext, walletId: string, delta: bigint): Promise<bigint>;
  createWalletTransaction(ctx: TenantContext, input: CreateWalletTransactionRecord): Promise<CustomerWalletTransactionEntity>;
  listWalletTransactions(ctx: TenantContext, walletId: string): Promise<CustomerWalletTransactionEntity[]>;
  nextPaymentNumber(ctx: TenantContext, date: Date): Promise<string>;
  createPayment(ctx: TenantContext, input: CreatePaymentRecord): Promise<PaymentTransactionEntity>;
  findPayment(ctx: TenantContext, paymentTransactionId: string): Promise<PaymentTransactionEntity | null>;
  listPayments?(ctx: TenantContext): Promise<PaymentTransactionEntity[]>;
  updatePaymentAllocated(ctx: TenantContext, paymentTransactionId: string, allocatedAmount: bigint, status: PaymentStatus): Promise<PaymentTransactionEntity>;
  listAllocations(ctx: TenantContext, paymentTransactionId: string): Promise<PaymentAllocationEntity[]>;
  createAllocation(ctx: TenantContext, input: CreateAllocationRecord): Promise<PaymentAllocationEntity>;
  findReceivable(ctx: TenantContext, receivableId: string): Promise<ReceivableEntity | null>;
  updateReceivablePaid(ctx: TenantContext, receivableId: string, paidAmount: bigint, status: PaymentStatus): Promise<ReceivableEntity>;
  createAuditLog(ctx: TenantContext, event: PaymentAuditEvent): Promise<void>;
}

export interface Meta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreateCustomerWalletCommand extends CreateWalletRecord, Meta {}
export interface WalletTopupCommand extends WalletMovementInput, Meta { cashAccountId: string; }
export interface WalletSpendCommand extends WalletMovementInput, Meta { revenueSettlementAccountId: string; }
export interface WalletRefundCommand extends WalletMovementInput, Meta { cashAccountId: string; }
export interface WalletAdjustmentCommand extends WalletMovementInput, Meta { adjustmentAccountId: string; direction: "INCREASE" | "DECREASE"; }
export interface CreatePaymentCommand extends Omit<CreatePaymentRecord, "paymentNumber">, Meta {}
export interface AllocatePaymentCommand { businessId: string; paymentTransactionId: string; allocations: PaymentAllocationInput[]; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface SettleReceivableCommand { businessId: string; receivableId: string; settlementDate: Date; amount: bigint; cashAccountId: string; description: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface GetWalletBalanceCommand { businessId: string; walletId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface WalletHistoryCommand extends GetWalletBalanceCommand {}
