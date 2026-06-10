import type {
  BalanceSheetReport,
  IncomeStatementReport,
  StatementLine,
  StatementSection,
} from "../../reporting/domain/reporting-types";

export type OrgType = "BUMDES" | "KOPERASI" | "HOLDING" | "FRANCHISE";
export type OrgRole = "ORG_OWNER" | "ORG_ADMIN" | "ORG_VIEWER";

export const ORG_TYPES: OrgType[] = ["BUMDES", "KOPERASI", "HOLDING", "FRANCHISE"];
export const ORG_ROLES: OrgRole[] = ["ORG_OWNER", "ORG_ADMIN", "ORG_VIEWER"];

export interface OrganizationEntity {
  id: string;
  name: string;
  type: OrgType;
  description: string | null;
  address: string | null;
  npwpNumber: string | null;
  settings: Record<string, unknown> | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgMemberEntity {
  organizationId: string;
  userId: string;
  role: OrgRole;
  joinedAt: Date;
  name?: string;
  email?: string;
}

export interface BusinessUnitRef {
  id: string;
  name: string;
  type: string;
}

export interface OrganizationDetail extends OrganizationEntity {
  units: BusinessUnitRef[];
  members: OrgMemberEntity[];
}

export interface CreateOrganizationInput {
  name: string;
  type: OrgType;
  description?: string | null;
  address?: string | null;
  npwpNumber?: string | null;
  settings?: Record<string, unknown> | null;
}

export interface UpdateOrganizationInput {
  name?: string;
  type?: OrgType;
  description?: string | null;
  address?: string | null;
  npwpNumber?: string | null;
  settings?: Record<string, unknown> | null;
}

export interface ConsolidationRange {
  startsOn: Date;
  endsOn: Date;
}

export type HealthStatus = "HEALTHY" | "WATCH" | "CRITICAL" | "NO_DATA";

export interface UnitIncomeStatement {
  businessId: string;
  name: string;
  report: IncomeStatementReport;
}

export interface ConsolidatedIncomeStatement {
  organizationId: string;
  startsOn: Date;
  endsOn: Date;
  units: UnitIncomeStatement[];
  consolidated: IncomeStatementReport;
}

export interface UnitBalanceSheet {
  businessId: string;
  name: string;
  report: BalanceSheetReport;
}

export interface ConsolidatedBalanceSheet {
  organizationId: string;
  asOf: Date;
  units: UnitBalanceSheet[];
  consolidated: BalanceSheetReport;
}

export interface UnitComparisonRow {
  businessId: string;
  name: string;
  revenue: bigint;
  netProfit: bigint;
  /** Margin dalam basis points (10000 = 100%) agar presisi tanpa float. */
  marginBps: number;
  healthStatus: HealthStatus;
}

export interface UnitComparisonReport {
  organizationId: string;
  startsOn: Date;
  endsOn: Date;
  units: UnitComparisonRow[];
  totalRevenue: bigint;
  totalNetProfit: bigint;
  totalMarginBps: number;
}

export class OrganizationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "OrganizationError";
  }
}

// Re-export tipe report yang dipakai konsumen agar import terpusat.
export type { IncomeStatementReport, BalanceSheetReport, StatementLine, StatementSection };
