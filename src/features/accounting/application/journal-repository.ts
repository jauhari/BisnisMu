import {
  AccountSnapshot,
  FiscalPeriodSnapshot,
  PostJournalInput,
  TenantContext,
  ValidatedJournal
} from "../domain/accounting-types";
import type { TxClient } from "../../shared/tx";

export interface PostedJournalResult {
  journalId: string;
  journalNumber: string;
  postedAt: Date;
  totalDebit: bigint;
  totalCredit: bigint;
}

export interface JournalRepository {
  findAccountsForPosting(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  findOpenFiscalPeriod(ctx: TenantContext, transactionDate: Date): Promise<FiscalPeriodSnapshot | null>;
  findPostedJournalByIdempotencyKey(ctx: TenantContext, idempotencyKey: string): Promise<PostedJournalResult | null>;
  createPostedJournal(ctx: TenantContext, journal: ValidatedJournal, tx?: TxClient): Promise<PostedJournalResult>;
  replacePostedJournal?(ctx: TenantContext, journalId: string, journal: ValidatedJournal): Promise<PostedJournalResult>;
  deletePostedJournal?(ctx: TenantContext, journalId: string): Promise<boolean>;
  createAuditLog(ctx: TenantContext, event: JournalAuditEvent): Promise<void>;
}

export interface JournalAuditEvent {
  action: "JOURNAL_POSTED" | "JOURNAL_POST_REJECTED" | "JOURNAL_UPDATED";
  businessId: string;
  actorUserId: string;
  entityType: "journal";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface PostJournalCommand extends PostJournalInput {
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

