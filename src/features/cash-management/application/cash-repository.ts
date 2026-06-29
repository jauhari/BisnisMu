import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CashTransactionDraftInput, CashTransactionEntity, ContactEntity, CreateContactInput, TenantContext } from "../domain/cash-types";
import type { TxClient } from "../../shared/tx";

export interface CashAuditEvent {
  action: "CONTACT_CREATED" | "CASH_TRANSACTION_DRAFTED" | "CASH_TRANSACTION_UPDATED" | "CASH_TRANSACTION_POSTED" | "CASH_TRANSACTION_VOIDED" | "CASH_JOURNAL_PREVIEWED";
  businessId: string;
  actorUserId: string;
  entityType: "contact" | "cash_transaction";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface CashRepository {
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  findContact(ctx: TenantContext, contactId: string): Promise<ContactEntity | null>;
  createContact(ctx: TenantContext, input: CreateContactInput): Promise<ContactEntity>;
  nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string>;
  createDraft(ctx: TenantContext, input: CashTransactionDraftInput, transactionNumber: string): Promise<CashTransactionEntity>;
  updateDraft(ctx: TenantContext, transactionId: string, input: CashTransactionDraftInput): Promise<CashTransactionEntity>;
  findTransaction(ctx: TenantContext, transactionId: string): Promise<CashTransactionEntity | null>;
  markPosted(ctx: TenantContext, transactionId: string, journalId: string, tx?: TxClient): Promise<CashTransactionEntity>;
  markVoided(ctx: TenantContext, transactionId: string, journalId: string, reason: string, tx?: TxClient): Promise<CashTransactionEntity>;
  deleteDraft(ctx: TenantContext, transactionId: string): Promise<boolean>;
  deleteAny(ctx: TenantContext, transactionId: string): Promise<boolean>;
  createAuditLog(ctx: TenantContext, event: CashAuditEvent): Promise<void>;
}

export interface CreateContactCommand extends CreateContactInput { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CashDraftCommand extends CashTransactionDraftInput { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface UpdateCashDraftCommand extends CashDraftCommand { transactionId: string; }
export interface PreviewCashCommand extends CashTransactionDraftInput { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface PostCashCommand { businessId: string; transactionId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface VoidCashCommand { businessId: string; transactionId: string; reason: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface DeleteCashDraftCommand { businessId: string; transactionId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
