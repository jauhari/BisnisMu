import type { ReportingService } from "../../reporting/application/reporting-service";
import { OrganizationEngine } from "../domain/organization-engine";
import {
  type ConsolidatedBalanceSheet,
  type ConsolidatedIncomeStatement,
  type ConsolidationRange,
  OrganizationError,
  type UnitComparisonReport,
} from "../domain/organization-types";
import type { OrganizationRepository } from "./organization-repository";

export class ConsolidationService {
  constructor(
    private readonly repo: OrganizationRepository,
    private readonly reporting: ReportingService,
    private readonly engine = new OrganizationEngine(),
  ) {}

  private async requireViewer(orgId: string, actorUserId: string): Promise<void> {
    const member = await this.repo.getMember(orgId, actorUserId);
    if (!member) throw new OrganizationError("FORBIDDEN", "Anda bukan anggota organisasi ini.");
    if (!this.engine.canViewReports(member.role)) throw new OrganizationError("FORBIDDEN", "Tidak boleh melihat laporan.");
  }

  async getConsolidatedIncomeStatement(
    actorUserId: string,
    orgId: string,
    range: ConsolidationRange,
  ): Promise<ConsolidatedIncomeStatement> {
    await this.requireViewer(orgId, actorUserId);
    const units = await this.repo.getBusinessUnits(orgId);

    const reports = await Promise.all(
      units.map((u) =>
        this.reporting.generateProfitAndLoss({
          businessId: u.id,
          actorUserId,
          startsOn: range.startsOn,
          endsOn: range.endsOn,
        }),
      ),
    );

    return {
      organizationId: orgId,
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      units: units.map((u, i) => ({ businessId: u.id, name: u.name, report: reports[i]! })),
      consolidated: this.engine.aggregateIncomeStatements(orgId, range, reports),
    };
  }

  async getConsolidatedBalanceSheet(
    actorUserId: string,
    orgId: string,
    range: ConsolidationRange,
  ): Promise<ConsolidatedBalanceSheet> {
    await this.requireViewer(orgId, actorUserId);
    const units = await this.repo.getBusinessUnits(orgId);

    const reports = await Promise.all(
      units.map((u) =>
        this.reporting.generateBalanceSheet({
          businessId: u.id,
          actorUserId,
          startsOn: range.startsOn,
          endsOn: range.endsOn,
        }),
      ),
    );

    return {
      organizationId: orgId,
      asOf: range.endsOn,
      units: units.map((u, i) => ({ businessId: u.id, name: u.name, report: reports[i]! })),
      consolidated: this.engine.aggregateBalanceSheets(orgId, range.endsOn, reports),
    };
  }

  async getUnitComparison(
    actorUserId: string,
    orgId: string,
    range: ConsolidationRange,
  ): Promise<UnitComparisonReport> {
    const pnl = await this.getConsolidatedIncomeStatement(actorUserId, orgId, range);
    const units = pnl.units.map((u) => this.engine.unitComparisonRow(u.businessId, u.name, u.report));
    const totalRevenue = pnl.consolidated.revenue.total;
    const totalNetProfit = pnl.consolidated.netIncome;
    return {
      organizationId: orgId,
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      units,
      totalRevenue,
      totalNetProfit,
      totalMarginBps: this.engine.marginBps(totalRevenue, totalNetProfit),
    };
  }
}
