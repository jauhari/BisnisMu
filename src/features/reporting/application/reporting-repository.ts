import { FiscalPeriodEntity } from "../../business/domain/business-types";
import { LedgerLineSource, ReportAccount, TenantContext } from "../domain/reporting-types";

export interface ReportAuditEvent {
  action: "REPORT_GENERATED";
  businessId: string;
  actorUserId: string;
  entityType: "report";
  metadata: Record<string, unknown>;
}

export interface LedgerRepository {
  listAccounts(ctx: TenantContext): Promise<ReportAccount[]>;
  listPostedLedgerLines(ctx: TenantContext, startsOn: Date, endsOn: Date): Promise<LedgerLineSource[]>;
  listPostedLedgerLinesUntil(ctx: TenantContext, endsOn: Date): Promise<LedgerLineSource[]>;
}

export interface ReportingRepository {
  findFiscalPeriod(ctx: TenantContext, fiscalPeriodId: string): Promise<FiscalPeriodEntity | null>;
  createAuditLog(ctx: TenantContext, event: ReportAuditEvent): Promise<void>;
}

export interface ReportCommand {
  businessId: string;
  actorUserId: string;
  startsOn?: Date;
  endsOn?: Date;
  fiscalPeriodId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

