import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";

export type CashTransactionType = "CASH_IN" | "CASH_OUT" | "TRANSFER";
export type CashTransactionStatus = "DRAFT" | "POSTED" | "VOID";
export type ContactType = "CUSTOMER" | "SUPPLIER" | "BOTH" | "OTHER";

export interface TenantContext {
  businessId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ContactEntity {
  id: string;
  businessId: string;
  name: string;
  type: ContactType;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
}

export interface CashTransactionEntity {
  id: string;
  businessId: string;
  transactionNumber: string;
  type: CashTransactionType;
  status: CashTransactionStatus;
  transactionDate: Date;
  cashAccountId: string;
  destinationAccountId?: string | null;
  categoryAccountId?: string | null;
  contactId?: string | null;
  amount: bigint;
  description: string;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  attachmentKey?: string | null;
  tags: string[];
  postedJournalId?: string | null;
  voidJournalId?: string | null;
  voidReason?: string | null;
  createdByUserId: string;
}

export interface CreateContactInput {
  businessId: string;
  name: string;
  type?: ContactType;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CashTransactionDraftInput {
  businessId: string;
  type: CashTransactionType;
  transactionDate: Date;
  cashAccountId: string;
  destinationAccountId?: string;
  categoryAccountId?: string;
  contactId?: string;
  amount: bigint;
  description: string;
  paymentMethod?: string;
  referenceNumber?: string;
  attachmentKey?: string;
  tags?: string[];
}

export interface JournalPreviewLine extends JournalLineInput {
  accountCode: string;
  accountName: string;
}

export interface JournalPreview {
  businessId: string;
  transactionDate: Date;
  source: CashTransactionType | "VOID_CASH_TRANSACTION";
  description: string;
  lines: JournalPreviewLine[];
  totalDebit: bigint;
  totalCredit: bigint;
  warnings: string[];
}

export interface CashValidationContext {
  cashAccount: AccountSnapshot | null;
  destinationAccount?: AccountSnapshot | null;
  categoryAccount?: AccountSnapshot | null;
  contact?: ContactEntity | null;
}

export class CashManagementError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "CashManagementError";
  }
}

