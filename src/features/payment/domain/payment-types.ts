import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";
import { FloatAccountEntity } from "../../float/domain/float-types";

export type PaymentMethodType = "CASH" | "BANK" | "QRIS" | "FLOAT" | "CUSTOMER_WALLET" | "ACCOUNTS_RECEIVABLE";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
export type WalletTransactionType = "TOPUP" | "SPEND" | "REFUND" | "ADJUSTMENT";
export type WalletAdjustmentDirection = "INCREASE" | "DECREASE";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }

export interface CustomerSnapshot { id: string; businessId: string; name: string; isActive: boolean; }

export interface CustomerWalletEntity {
  id: string;
  businessId: string;
  customerId: string;
  depositLiabilityAccountId: string;
  currentBalance: bigint;
  isActive: boolean;
}

export interface CustomerWalletTransactionEntity {
  id: string;
  businessId: string;
  walletId: string;
  customerId: string;
  type: WalletTransactionType;
  transactionDate: Date;
  amount: bigint;
  balanceAfter: bigint;
  description: string;
  postedJournalId?: string | null;
  createdByUserId: string;
}

export interface PaymentMethodEntity {
  id: string;
  businessId: string;
  type: PaymentMethodType;
  name: string;
  accountId?: string | null;
  floatAccountId?: string | null;
  isActive: boolean;
}

export interface PaymentTransactionEntity {
  id: string;
  businessId: string;
  paymentNumber: string;
  customerId: string;
  transactionDate: Date;
  totalAmount: bigint;
  allocatedAmount: bigint;
  status: PaymentStatus;
  description: string;
  revenueSettlementAccountId: string;
  arAccountId?: string | null;
  postedJournalId?: string | null;
  createdByUserId: string;
}

export interface PaymentAllocationEntity {
  id: string;
  businessId: string;
  paymentTransactionId: string;
  method: PaymentMethodType;
  amount: bigint;
  accountId?: string | null;
  walletId?: string | null;
  floatAccountId?: string | null;
  receivableId?: string | null;
  postedJournalId?: string | null;
}

export interface ReceivableEntity {
  id: string;
  businessId: string;
  customerId: string;
  totalAmount: bigint;
  paidAmount: bigint;
  status: PaymentStatus;
  arAccountId: string;
}

export interface CreateCustomerWalletInput { businessId: string; customerId: string; depositLiabilityAccountId: string; openingBalance?: bigint; }
export interface WalletMovementInput { businessId: string; walletId: string; transactionDate: Date; amount: bigint; description: string; cashAccountId?: string; revenueSettlementAccountId?: string; adjustmentAccountId?: string; direction?: WalletAdjustmentDirection; }
export interface CreatePaymentInput { businessId: string; customerId: string; transactionDate: Date; totalAmount: bigint; description: string; revenueSettlementAccountId: string; arAccountId?: string; }
export interface PaymentAllocationInput { method: PaymentMethodType; amount: bigint; accountId?: string; walletId?: string; floatAccountId?: string; receivableId?: string; }
export interface AllocatePaymentInput { businessId: string; paymentTransactionId: string; allocations: PaymentAllocationInput[]; }
export interface SettleReceivableInput { businessId: string; receivableId: string; settlementDate: Date; amount: bigint; cashAccountId: string; description: string; }

export interface JournalPreviewLine extends JournalLineInput { accountCode: string; accountName: string; }
export interface PaymentJournalPreview { businessId: string; transactionDate: Date; source: string; description: string; lines: JournalPreviewLine[]; totalDebit: bigint; totalCredit: bigint; }

export interface PaymentValidationContext {
  customer?: CustomerSnapshot | null;
  wallet?: CustomerWalletEntity | null;
  payment?: PaymentTransactionEntity | null;
  receivable?: ReceivableEntity | null;
  floatAccount?: FloatAccountEntity | null;
  depositLiabilityAccount?: AccountSnapshot | null;
  cashAccount?: AccountSnapshot | null;
  revenueSettlementAccount?: AccountSnapshot | null;
  arAccount?: AccountSnapshot | null;
  floatSettlementAccount?: AccountSnapshot | null;
  qrisClearingAccount?: AccountSnapshot | null;
  adjustmentAccount?: AccountSnapshot | null;
}

export class PaymentError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "PaymentError";
  }
}
