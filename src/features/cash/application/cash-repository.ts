import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CashDrawerEntity, CashMovementEntity, CashReconciliationEntity, CashSessionEntity, CashSessionStatus, CloseSessionInput, OpenSessionInput, ReconcileCashInput, RecordCashMovementInput, TenantContext, TransferCashInput } from "../domain/cash-types";

export interface CashAuditEvent { action: "CASH_SESSION_OPENED" | "CASH_SESSION_CLOSED" | "CASH_MOVEMENT_RECORDED" | "CASH_TRANSFER_RECORDED" | "CASH_RECONCILED"; businessId: string; actorUserId: string; entityType: "cash_session" | "cash_movement" | "cash_reconciliation"; entityId?: string; metadata: Record<string, unknown>; }
export interface CashRepository {
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  findDrawer(ctx: TenantContext, drawerId: string): Promise<CashDrawerEntity | null>;
  findOpenSessionByDrawer(ctx: TenantContext, drawerId: string): Promise<CashSessionEntity | null>;
  createSession(ctx: TenantContext, input: OpenSessionInput, cashAccountId: string): Promise<CashSessionEntity>;
  findSession(ctx: TenantContext, sessionId: string): Promise<CashSessionEntity | null>;
  updateSessionExpected(ctx: TenantContext, sessionId: string, expectedClosingAmount: bigint): Promise<CashSessionEntity>;
  closeSession(ctx: TenantContext, sessionId: string, input: CloseSessionInput, differenceAmount: bigint): Promise<CashSessionEntity>;
  createMovement(ctx: TenantContext, input: RecordCashMovementInput | TransferCashInput, type: CashMovementEntity["type"], cashAccountId: string, amount: bigint, postedJournalId: string, destinationCashAccountId?: string | null): Promise<CashMovementEntity>;
  createReconciliation(ctx: TenantContext, input: ReconcileCashInput, expectedAmount: bigint, differenceAmount: bigint, postedJournalId?: string | null): Promise<CashReconciliationEntity>;
  createAuditLog(ctx: TenantContext, event: CashAuditEvent): Promise<void>;
}
export interface Meta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface OpenSessionCommand extends OpenSessionInput, Meta {}
export interface CloseSessionCommand extends CloseSessionInput, Meta {}
export interface RecordCashMovementCommand extends RecordCashMovementInput, Meta {}
export interface TransferCashCommand extends TransferCashInput, Meta {}
export interface ReconcileCashCommand extends ReconcileCashInput, Meta {}
