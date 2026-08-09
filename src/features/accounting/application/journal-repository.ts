import {
  AccountSnapshot,
  FiscalPeriodSnapshot,
  JournalLineInput,
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

/** A posted journal together with its lines, used as the source of a reversal. */
export interface PostedJournalDetail extends PostedJournalResult {
  transactionDate: Date;
  source: string;
  sourceId?: string | null;
  description: string;
  lines: JournalLineInput[];
}

export interface JournalRepository {
  findAccountsForPosting(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  findOpenFiscalPeriod(ctx: TenantContext, transactionDate: Date): Promise<FiscalPeriodSnapshot | null>;
  findPostedJournalByIdempotencyKey(ctx: TenantContext, idempotencyKey: string): Promise<PostedJournalResult | null>;
  findPostedJournalWithLines(ctx: TenantContext, journalId: string): Promise<PostedJournalDetail | null>;
  createPostedJournal(ctx: TenantContext, journal: ValidatedJournal): Promise<PostedJournalResult>;
  createAuditLog(ctx: TenantContext, event: JournalAuditEvent): Promise<void>;
}

export interface JournalAuditEvent {
  action: "JOURNAL_POSTED" | "JOURNAL_POST_REJECTED" | "JOURNAL_REVERSED";
  businessId: string;
  actorUserId: string;
  entityType: "journal";
  entityId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Reverses an already-posted journal. The reversal is keyed on the source journal,
 * so replaying the same command returns the existing reversal instead of posting twice.
 */
export interface ReverseJournalCommand {
  businessId: string;
  actorUserId: string;
  journalId: string;
  /** Date to book the reversal on. Defaults to the source journal's transaction date. */
  reversalDate?: Date;
  reason: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PostJournalCommand extends PostJournalInput {
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

