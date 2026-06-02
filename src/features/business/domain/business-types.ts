import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";

export type BusinessType = "UMKM" | "BUMDES" | "PERORANGAN" | "CV" | "UD";
export type BusinessStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type FiscalPeriodStatus = "OPEN" | "CLOSED";
export type BeginningBalanceStatus = "DRAFT" | "POSTED";
export type JournalSide = "DEBIT" | "CREDIT";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }

export interface BusinessEntity {
  id: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  npwpNumber?: string | null;
  address?: string | null;
  fiscalYearStart: number;
  currency: "IDR";
  settings?: Record<string, unknown> | null;
  createdByUserId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FiscalPeriodEntity {
  id: string;
  businessId: string;
  name: string;
  fiscalYear: number;
  startsOn: Date;
  endsOn: Date;
  status: FiscalPeriodStatus;
  isClosed: boolean;
  closedAt?: Date | null;
  closedByUserId?: string | null;
  reopenedAt?: Date | null;
  reopenedByUserId?: string | null;
  reopenReason?: string | null;
}

export interface BeginningBalanceLine { accountId: string; side: JournalSide; amount: bigint; }
export interface BeginningBalanceEntry extends BeginningBalanceLine { id: string; businessId: string; fiscalPeriodId: string; status: BeginningBalanceStatus; postedJournalId?: string | null; }

export interface CreateBusinessInput { name: string; type: BusinessType; npwpNumber?: string; address?: string; fiscalYearStart?: number; currency?: "IDR"; settings?: Record<string, unknown>; }
export interface UpdateBusinessSettingsInput { businessId: string; name?: string; npwpNumber?: string | null; address?: string | null; fiscalYearStart?: number; settings?: Record<string, unknown>; }
export interface OpenFiscalPeriodInput { businessId: string; fiscalYear: number; }
export interface CloseFiscalPeriodInput { businessId: string; fiscalPeriodId: string; }
export interface ReopenFiscalPeriodInput { businessId: string; fiscalPeriodId: string; reason: string; }
export interface SaveBeginningBalancesInput { businessId: string; fiscalPeriodId: string; lines: BeginningBalanceLine[]; }
export interface BeginningBalanceValidationContext { period: FiscalPeriodEntity; accounts: AccountSnapshot[]; }
export interface BeginningBalanceJournalInput { businessId: string; fiscalPeriod: FiscalPeriodEntity; lines: JournalLineInput[]; }

export class BusinessDomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "BusinessDomainError";
  }
}
