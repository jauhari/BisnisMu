import {
  AccountSnapshot,
  FiscalPeriodSnapshot,
  PostJournalInput,
  TenantContext,
  ValidatedJournal
} from "../domain/accounting-types";

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
  createPostedJournal(ctx: TenantContext, journal: ValidatedJournal): Promise<PostedJournalResult>;
  createAuditLog(ctx: TenantContext, event: JournalAuditEvent): Promise<void>;
}

export interface JournalAuditEvent {
  action: "JOURNAL_POSTED" | "JOURNAL_POST_REJECTED";
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

