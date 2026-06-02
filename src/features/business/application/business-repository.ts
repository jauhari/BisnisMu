import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { BeginningBalanceEntry, BeginningBalanceLine, BusinessEntity, CreateBusinessInput, FiscalPeriodEntity, TenantContext, UpdateBusinessSettingsInput } from "../domain/business-types";

export interface BusinessAuditEvent {
  action: "BUSINESS_CREATED" | "BUSINESS_SETTINGS_UPDATED" | "FISCAL_PERIOD_OPENED" | "FISCAL_PERIOD_CLOSED" | "FISCAL_PERIOD_REOPENED" | "BEGINNING_BALANCE_SAVED" | "BEGINNING_BALANCE_POSTED";
  businessId: string;
  actorUserId: string;
  entityType: "business" | "fiscal_period" | "beginning_balance";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface BusinessRepository {
  createBusiness(actorUserId: string, input: CreateBusinessInput & { name: string; currency: "IDR"; fiscalYearStart: number }): Promise<BusinessEntity>;
  findBusiness(ctx: TenantContext): Promise<BusinessEntity | null>;
  updateBusinessSettings(ctx: TenantContext, input: UpdateBusinessSettingsInput): Promise<BusinessEntity>;
  findFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string): Promise<FiscalPeriodEntity | null>;
  findFiscalPeriodByYear(ctx: TenantContext, fiscalYear: number): Promise<FiscalPeriodEntity | null>;
  createFiscalPeriod(ctx: TenantContext, input: { name: string; fiscalYear: number; startsOn: Date; endsOn: Date }): Promise<FiscalPeriodEntity>;
  closeFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string): Promise<FiscalPeriodEntity>;
  reopenFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string, reason: string): Promise<FiscalPeriodEntity>;
  findAccountsForBeginningBalance(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  saveBeginningBalances(ctx: TenantContext, fiscalPeriodId: string, lines: BeginningBalanceLine[]): Promise<BeginningBalanceEntry[]>;
  listBeginningBalances(ctx: TenantContext, fiscalPeriodId: string): Promise<BeginningBalanceEntry[]>;
  markBeginningBalancesPosted(ctx: TenantContext, fiscalPeriodId: string, journalId: string): Promise<void>;
  createAuditLog(ctx: TenantContext, event: BusinessAuditEvent): Promise<void>;
}

export interface CreateBusinessCommand extends CreateBusinessInput { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface UpdateBusinessSettingsCommand extends UpdateBusinessSettingsInput { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface OpenFiscalPeriodCommand { businessId: string; fiscalYear: number; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CloseFiscalPeriodCommand { businessId: string; fiscalPeriodId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface ReopenFiscalPeriodCommand { businessId: string; fiscalPeriodId: string; reason: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface SaveBeginningBalancesCommand { businessId: string; fiscalPeriodId: string; lines: BeginningBalanceLine[]; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface PostBeginningBalancesCommand { businessId: string; fiscalPeriodId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
