export type MemberStatus = "ACTIVE" | "INACTIVE" | "RESIGNED";
export type MemberSavingType = "POKOK" | "WAJIB" | "SUKARELA";
export type MemberSavingDirection = "DEPOSIT" | "WITHDRAWAL";
export type MemberLoanStatus = "ACTIVE" | "PAID" | "WRITTEN_OFF";
export type MemberLoanInterestMethod = "FLAT";
export type MemberInstallmentStatus = "PENDING" | "PAID";

export interface MemberTenantContext {
  businessId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type MemberErrorCode =
  | "INVALID_MEMBER_NUMBER"
  | "MEMBER_NUMBER_TAKEN"
  | "MEMBER_NOT_FOUND"
  | "INVALID_AMOUNT"
  | "INSUFFICIENT_SAVINGS"
  | "INVALID_TERM"
  | "INVALID_INTEREST_RATE"
  | "INVALID_PRINCIPAL"
  | "LOAN_NOT_FOUND"
  | "INSTALLMENT_NOT_FOUND"
  | "INSTALLMENT_ALREADY_PAID"
  | "INSTALLMENT_AMOUNT_MISMATCH"
  | "ACCOUNT_NOT_FOUND";

export class MemberError extends Error {
  constructor(
    readonly code: MemberErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MemberError";
  }
}

export interface PlannedInstallment {
  installmentNo: number;
  dueDate: Date;
  principalDue: bigint;
  interestDue: bigint;
}

export interface FlatScheduleInput {
  principal: bigint;
  interestRateBps: number;
  termMonths: number;
  disbursedOn: Date;
}

export interface SavingsBalances {
  POKOK: bigint;
  WAJIB: bigint;
  SUKARELA: bigint;
}

export function emptySavingsBalances(): SavingsBalances {
  return { POKOK: 0n, WAJIB: 0n, SUKARELA: 0n };
}

/** Setting default koperasi; disimpan di `Business.settings.memberLoan`. */
export interface MemberLoanSettings {
  defaultInterestRateBps: number;
  defaultTermMonths: number;
}

export const DEFAULT_MEMBER_LOAN_SETTINGS: MemberLoanSettings = {
  defaultInterestRateBps: 0,
  defaultTermMonths: 12,
};

export function readMemberLoanSettings(raw: unknown): MemberLoanSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_MEMBER_LOAN_SETTINGS;
  const source = (raw as Record<string, unknown>).memberLoan;
  if (!source || typeof source !== "object") return DEFAULT_MEMBER_LOAN_SETTINGS;
  const candidate = source as Record<string, unknown>;
  const rate = Number(candidate.defaultInterestRateBps);
  const term = Number(candidate.defaultTermMonths);
  return {
    defaultInterestRateBps: Number.isFinite(rate) && rate >= 0 ? Math.trunc(rate) : DEFAULT_MEMBER_LOAN_SETTINGS.defaultInterestRateBps,
    defaultTermMonths: Number.isFinite(term) && term > 0 ? Math.trunc(term) : DEFAULT_MEMBER_LOAN_SETTINGS.defaultTermMonths,
  };
}
