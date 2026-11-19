import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreateFloatAccountInput, FloatAccountEntity, FloatBalanceSnapshotEntity, FloatBalanceSnapshotInput, FloatTopupInput, FloatTransactionEntity, FloatTransactionInput, TenantContext } from "../domain/float-types";

export interface FloatAuditEvent {
  action: "FLOAT_ACCOUNT_CREATED" | "FLOAT_TOPUP_POSTED" | "FLOAT_CONSUMPTION_POSTED" | "FLOAT_TRANSFER_POSTED" | "FLOAT_ADJUSTMENT_POSTED" | "FLOAT_BALANCE_SNAPSHOT_CREATED";
  businessId: string;
  actorUserId: string;
  entityType: "float_account" | "float_transaction" | "float_balance_snapshot";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface CreateFloatTransactionRecord extends FloatTransactionInput {
  type: "TOPUP" | "CONSUME" | "TRANSFER" | "ADJUSTMENT";
  transactionNumber: string;
  balanceAfter: bigint;
  postedJournalId: string;
  destinationFloatAccountId?: string;
  cashAccountId?: string;
}

export interface FloatRepository {
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  createFloatAccount(ctx: TenantContext, input: CreateFloatAccountInput): Promise<FloatAccountEntity>;
  findFloatAccount(ctx: TenantContext, floatAccountId: string): Promise<FloatAccountEntity | null>;
  nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string>;
  createTransaction(ctx: TenantContext, input: CreateFloatTransactionRecord): Promise<FloatTransactionEntity>;
  /**
   * Atomically applies a signed delta to the float balance and returns the
   * resulting balance. Prevents lost updates under concurrent transactions
   * (unlike read-compute-overwrite).
   */
  incrementFloatBalance(ctx: TenantContext, floatAccountId: string, delta: bigint): Promise<bigint>;
  createBalanceSnapshot(ctx: TenantContext, input: FloatBalanceSnapshotInput, balance: bigint): Promise<FloatBalanceSnapshotEntity>;
  createAuditLog(ctx: TenantContext, event: FloatAuditEvent): Promise<void>;
}

export interface FloatCommandMeta { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreateFloatAccountCommand extends CreateFloatAccountInput { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface TopupFloatCommand extends FloatTopupInput { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface ConsumeFloatCommand extends FloatTopupInput { expenseAccountId?: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface TransferFloatCommand extends FloatTransactionInput { destinationFloatAccountId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface AdjustFloatCommand extends FloatTransactionInput { direction: "INCREASE" | "DECREASE"; adjustmentAccountId?: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface GetFloatBalanceCommand extends FloatCommandMeta { floatAccountId: string; }
export interface CreateFloatBalanceSnapshotCommand extends FloatCommandMeta { floatAccountId: string; snapshotDate: Date; }
