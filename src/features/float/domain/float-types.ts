import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";

export type FloatProvider = "BUKUWARUNG" | "FASTPAY" | "PAYFAZZ" | "SHOPEEPAY" | "LINKAJA" | "CUSTOM";
export type FloatTransactionType = "TOPUP" | "CONSUME" | "TRANSFER" | "ADJUSTMENT";
export type FloatAdjustmentDirection = "INCREASE" | "DECREASE";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }

export interface FloatAccountEntity {
  id: string;
  businessId: string;
  provider: FloatProvider;
  providerAccountId?: string | null;
  name: string;
  floatAssetAccountId: string;
  offsetAccountId: string;
  currentBalance: bigint;
  isActive: boolean;
}

export interface FloatTransactionEntity {
  id: string;
  businessId: string;
  transactionNumber: string;
  type: FloatTransactionType;
  floatAccountId: string;
  destinationFloatAccountId?: string | null;
  cashAccountId?: string | null;
  transactionDate: Date;
  amount: bigint;
  balanceAfter: bigint;
  description: string;
  postedJournalId?: string | null;
  createdByUserId: string;
}

export interface FloatBalanceSnapshotEntity {
  id: string;
  businessId: string;
  floatAccountId: string;
  snapshotDate: Date;
  balance: bigint;
}

export interface CreateFloatAccountInput {
  businessId: string;
  provider: FloatProvider;
  providerAccountId?: string;
  name: string;
  floatAssetAccountId: string;
  offsetAccountId: string;
  openingBalance?: bigint;
}

export interface FloatTransactionInput {
  businessId: string;
  floatAccountId: string;
  transactionDate: Date;
  amount: bigint;
  description: string;
  referenceNumber?: string;
}

export interface FloatTopupInput extends FloatTransactionInput { cashAccountId?: string; }
export interface FloatConsumptionInput extends FloatTransactionInput { expenseAccountId?: string; }
export interface FloatTransferInput extends FloatTransactionInput { destinationFloatAccountId: string; }
export interface FloatAdjustmentInput extends FloatTransactionInput { direction: FloatAdjustmentDirection; adjustmentAccountId?: string; }

export interface FloatBalanceSnapshotInput { businessId: string; floatAccountId: string; snapshotDate: Date; }

export interface JournalPreviewLine extends JournalLineInput { accountCode: string; accountName: string; }

export interface FloatJournalPreview {
  businessId: string;
  transactionDate: Date;
  source: FloatTransactionType;
  description: string;
  lines: JournalPreviewLine[];
  totalDebit: bigint;
  totalCredit: bigint;
}

export interface FloatValidationContext {
  floatAccount: FloatAccountEntity | null;
  destinationFloatAccount?: FloatAccountEntity | null;
  floatAssetAccount?: AccountSnapshot | null;
  destinationFloatAssetAccount?: AccountSnapshot | null;
  offsetAccount?: AccountSnapshot | null;
  cashAccount?: AccountSnapshot | null;
  expenseAccount?: AccountSnapshot | null;
  adjustmentAccount?: AccountSnapshot | null;
}

export class FloatManagementError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "FloatManagementError";
  }
}
