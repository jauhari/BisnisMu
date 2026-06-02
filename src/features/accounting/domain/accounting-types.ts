export type AccountGroupCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type NormalBalance = "DEBIT" | "CREDIT";
export type JournalSide = "DEBIT" | "CREDIT";
export type JournalStatus = "DRAFT" | "POSTED" | "REVERSED";

export interface TenantContext {
  businessId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AccountSnapshot {
  id: string;
  businessId: string;
  code: string;
  name: string;
  groupCode: AccountGroupCode;
  normalBalance: NormalBalance;
  subtype?: string | null;
  isPostingAllowed: boolean;
  isActive: boolean;
}

export interface FiscalPeriodSnapshot {
  id: string;
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  isClosed: boolean;
}

export interface JournalLineInput {
  accountId: string;
  side: JournalSide;
  amount: bigint;
  memo?: string;
}

export interface PostJournalInput {
  businessId: string;
  transactionDate: Date;
  source: string;
  sourceId?: string;
  description: string;
  lines: JournalLineInput[];
  idempotencyKey?: string;
}

export interface ValidatedJournalLine extends JournalLineInput {
  account: AccountSnapshot;
}

export interface ValidatedJournal {
  businessId: string;
  transactionDate: Date;
  fiscalPeriod: FiscalPeriodSnapshot;
  source: string;
  sourceId?: string;
  description: string;
  lines: ValidatedJournalLine[];
  totalDebit: bigint;
  totalCredit: bigint;
  idempotencyKey?: string;
}

export class AccountingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AccountingError";
  }
}
