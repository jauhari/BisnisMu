import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";

export type CashSessionStatus = "OPEN" | "CLOSED";
export type CashMovementType = "OPENING_BALANCE" | "SALE_RECEIPT" | "CUSTOMER_DEPOSIT" | "EXPENSE" | "WITHDRAWAL" | "TRANSFER" | "ADJUSTMENT" | "CLOSING";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CashDrawerEntity { id: string; businessId: string; name: string; cashAccountId: string; isActive: boolean; }
export interface CashSessionEntity { id: string; businessId: string; drawerId: string; cashAccountId: string; status: CashSessionStatus; openedAt: Date; closedAt?: Date | null; openingAmount: bigint; expectedClosingAmount: bigint; countedClosingAmount?: bigint | null; differenceAmount?: bigint | null; openedByUserId: string; closedByUserId?: string | null; shiftCode?: string | null; }
export interface CashMovementEntity { id: string; businessId: string; sessionId?: string | null; drawerId?: string | null; type: CashMovementType; movementDate: Date; cashAccountId: string; destinationCashAccountId?: string | null; amount: bigint; description: string; postedJournalId?: string | null; createdByUserId: string; }
export interface CashReconciliationEntity { id: string; businessId: string; sessionId: string; expectedAmount: bigint; countedAmount: bigint; differenceAmount: bigint; reconciledAt: Date; postedJournalId?: string | null; reconciledByUserId: string; }

export interface OpenSessionInput { businessId: string; drawerId: string; openedAt: Date; openingAmount: bigint; equityAccountId: string; shiftCode?: string; }
export interface CloseSessionInput { businessId: string; sessionId: string; closedAt: Date; countedAmount: bigint; differenceAccountId: string; }
export interface RecordCashMovementInput { businessId: string; sessionId?: string; drawerId?: string; type: CashMovementType; movementDate: Date; cashAccountId: string; amount: bigint; description: string; categoryAccountId?: string; }
export interface TransferCashInput { businessId: string; sessionId?: string; sourceCashAccountId: string; destinationCashAccountId: string; movementDate: Date; amount: bigint; description: string; }
export interface ReconcileCashInput { businessId: string; sessionId: string; reconciledAt: Date; countedAmount: bigint; differenceAccountId: string; }

export interface JournalPreviewLine extends JournalLineInput { accountCode: string; accountName: string; }
export interface CashJournalPreview { businessId: string; transactionDate: Date; source: string; description: string; lines: JournalPreviewLine[]; totalDebit: bigint; totalCredit: bigint; }
export interface CashValidationContext { drawer?: CashDrawerEntity | null; session?: CashSessionEntity | null; cashAccount?: AccountSnapshot | null; destinationCashAccount?: AccountSnapshot | null; categoryAccount?: AccountSnapshot | null; equityAccount?: AccountSnapshot | null; differenceAccount?: AccountSnapshot | null; }

export class CashError extends Error { constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) { super(message); this.name = "CashError"; } }
