import {
  type BalanceSheetReport,
  type HealthStatus,
  type IncomeStatementReport,
  type OrgRole,
  type OrgType,
  ORG_ROLES,
  ORG_TYPES,
  OrganizationError,
  type StatementLine,
  type StatementSection,
  type UnitComparisonRow,
} from "./organization-types";

const HEALTHY_BPS = 3000; // margin >= 30%
const WATCH_BPS = 1000; // margin 10%..30%

export class OrganizationEngine {
  // ── Validasi ──────────────────────────────────────────────────────────────
  validateName(name: string): string {
    const trimmed = (name ?? "").trim();
    if (trimmed.length < 3) throw new OrganizationError("INVALID_NAME", "Nama organisasi minimal 3 karakter.");
    if (trimmed.length > 120) throw new OrganizationError("INVALID_NAME", "Nama organisasi maksimal 120 karakter.");
    return trimmed;
  }

  validateType(type: string): OrgType {
    if (!ORG_TYPES.includes(type as OrgType)) {
      throw new OrganizationError("INVALID_TYPE", `Tipe organisasi tidak valid: ${type}`);
    }
    return type as OrgType;
  }

  validateRole(role: string): OrgRole {
    if (!ORG_ROLES.includes(role as OrgRole)) {
      throw new OrganizationError("INVALID_ROLE", `Peran organisasi tidak valid: ${role}`);
    }
    return role as OrgRole;
  }

  // ── Permission (OrgRole) ────────────────────────────────────────────────────
  canViewReports(_role: OrgRole): boolean { return true; }
  canAddUnit(role: OrgRole): boolean { return role === "ORG_OWNER" || role === "ORG_ADMIN"; }
  canRemoveUnit(role: OrgRole): boolean { return role === "ORG_OWNER"; }
  canDeleteOrg(role: OrgRole): boolean { return role === "ORG_OWNER"; }
  canManageMembers(role: OrgRole): boolean { return role === "ORG_OWNER" || role === "ORG_ADMIN"; }
  canUpdateOrg(role: OrgRole): boolean { return role === "ORG_OWNER" || role === "ORG_ADMIN"; }
  canWriteTransactions(role: OrgRole): boolean { return role === "ORG_OWNER" || role === "ORG_ADMIN"; }

  /** Cascade OrgRole -> efektif BusinessRole di setiap unit. */
  businessRoleFor(role: OrgRole): "ADMIN" | "VIEWER" {
    return role === "ORG_VIEWER" ? "VIEWER" : "ADMIN";
  }

  // ── Kesehatan unit ──────────────────────────────────────────────────────────
  marginBps(revenue: bigint, netProfit: bigint): number {
    if (revenue <= 0n) return 0;
    return Number((netProfit * 10000n) / revenue);
  }

  healthStatus(revenue: bigint, netProfit: bigint): HealthStatus {
    if (revenue <= 0n) return "NO_DATA";
    if (netProfit <= 0n) return "CRITICAL";
    const bps = this.marginBps(revenue, netProfit);
    if (bps >= HEALTHY_BPS) return "HEALTHY";
    if (bps >= WATCH_BPS) return "WATCH";
    return "CRITICAL";
  }

  // ── Agregasi laporan (pure) ──────────────────────────────────────────────────

  /** Gabungkan beberapa StatementSection: jumlahkan baris berdasarkan accountCode. */
  mergeSections(sections: StatementSection[]): StatementSection {
    const byCode = new Map<string, StatementLine>();
    let total = 0n;
    for (const section of sections) {
      total += section.total;
      for (const line of section.lines) {
        const existing = byCode.get(line.accountCode);
        if (existing) {
          existing.amount += line.amount;
        } else {
          byCode.set(line.accountCode, { ...line });
        }
      }
    }
    const lines = [...byCode.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return { lines, total };
  }

  private sumLines(lines: StatementLine[], fallback: StatementLine): StatementLine {
    if (lines.length === 0) return { ...fallback, amount: 0n };
    const base: StatementLine = { ...lines[0]!, amount: 0n };
    for (const l of lines) base.amount += l.amount;
    return base;
  }

  aggregateIncomeStatements(
    organizationId: string,
    range: { startsOn: Date; endsOn: Date },
    reports: IncomeStatementReport[],
  ): IncomeStatementReport {
    return {
      businessId: organizationId,
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      revenue: this.mergeSections(reports.map((r) => r.revenue)),
      cogs: this.mergeSections(reports.map((r) => r.cogs)),
      expenses: this.mergeSections(reports.map((r) => r.expenses)),
      otherExpenses: this.mergeSections(reports.map((r) => r.otherExpenses)),
      grossProfit: reports.reduce((s, r) => s + r.grossProfit, 0n),
      netIncome: reports.reduce((s, r) => s + r.netIncome, 0n),
    };
  }

  aggregateBalanceSheets(
    organizationId: string,
    asOf: Date,
    reports: BalanceSheetReport[],
  ): BalanceSheetReport {
    const retainedFallback: StatementLine = { accountId: "", accountCode: "", accountName: "Laba Ditahan", amount: 0n };
    const currentFallback: StatementLine = { accountId: "", accountCode: "", accountName: "Laba Periode Berjalan", amount: 0n };
    const totalAssets = reports.reduce((s, r) => s + r.totalAssets, 0n);
    const totalLiabilitiesAndEquity = reports.reduce((s, r) => s + r.totalLiabilitiesAndEquity, 0n);
    return {
      businessId: organizationId,
      asOf,
      assets: this.mergeSections(reports.map((r) => r.assets)),
      liabilities: this.mergeSections(reports.map((r) => r.liabilities)),
      equity: this.mergeSections(reports.map((r) => r.equity)),
      retainedEarnings: this.sumLines(reports.map((r) => r.retainedEarnings), retainedFallback),
      currentPeriodEarnings: this.sumLines(reports.map((r) => r.currentPeriodEarnings), currentFallback),
      totalAssets,
      totalLiabilitiesAndEquity,
      isBalanced: totalAssets === totalLiabilitiesAndEquity,
    };
  }

  unitComparisonRow(businessId: string, name: string, report: IncomeStatementReport): UnitComparisonRow {
    const revenue = report.revenue.total;
    const netProfit = report.netIncome;
    return {
      businessId,
      name,
      revenue,
      netProfit,
      marginBps: this.marginBps(revenue, netProfit),
      healthStatus: this.healthStatus(revenue, netProfit),
    };
  }
}
