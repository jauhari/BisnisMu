import { ReportingEngine } from "../domain/reporting-engine";
import { ReportDateRange, ReportingError, TenantContext } from "../domain/reporting-types";
import { LedgerRepository, ReportCommand, ReportingRepository } from "./reporting-repository";

export class ReportingService {
  constructor(
    private readonly reportingRepository: ReportingRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly engine = new ReportingEngine()
  ) {}

  async generateGeneralLedger(command: ReportCommand) {
    const ctx = this.contextFrom(command);
    const range = await this.resolveRange(ctx, command);
    const [accounts, openingLines, periodLines] = await Promise.all([
      this.ledgerRepository.listAccounts(ctx),
      this.ledgerRepository.listPostedLedgerLinesUntil(ctx, this.dayBefore(range.startsOn)),
      this.ledgerRepository.listPostedLedgerLines(ctx, range.startsOn, range.endsOn)
    ]);
    const report = this.engine.generateGeneralLedger(range, accounts, openingLines, periodLines);
    await this.audit(ctx, "GENERAL_LEDGER", range);
    return report;
  }

  async generateTrialBalance(command: ReportCommand) {
    const ctx = this.contextFrom(command);
    const range = await this.resolveRange(ctx, command);
    const [accounts, lines] = await Promise.all([
      this.ledgerRepository.listAccounts(ctx),
      this.ledgerRepository.listPostedLedgerLinesUntil(ctx, range.endsOn)
    ]);
    const report = this.engine.generateTrialBalance(range, accounts, lines);
    await this.audit(ctx, "TRIAL_BALANCE", range);
    return report;
  }

  async generateIncomeStatement(command: ReportCommand) {
    const ctx = this.contextFrom(command);
    const range = await this.resolveRange(ctx, command);
    const [accounts, lines] = await Promise.all([
      this.ledgerRepository.listAccounts(ctx),
      this.ledgerRepository.listPostedLedgerLines(ctx, range.startsOn, range.endsOn)
    ]);
    const report = this.engine.generateIncomeStatement(range, accounts, lines);
    await this.audit(ctx, "INCOME_STATEMENT", range);
    return report;
  }

  async generateProfitAndLoss(command: ReportCommand) {
    const ctx = this.contextFrom(command);
    const range = await this.resolveRange(ctx, command);
    const [accounts, lines] = await Promise.all([
      this.ledgerRepository.listAccounts(ctx),
      this.ledgerRepository.listPostedLedgerLines(ctx, range.startsOn, range.endsOn)
    ]);
    const report = this.engine.generateProfitAndLoss(range, accounts, lines);
    await this.audit(ctx, "PROFIT_AND_LOSS", range);
    return report;
  }

  async generateProfitLoss(command: ReportCommand) {
    return this.generateProfitAndLoss(command);
  }

  async generateBalanceSheet(command: ReportCommand) {
    const ctx = this.contextFrom(command);
    const range = await this.resolveRange(ctx, command);
    const [accounts, lines] = await Promise.all([
      this.ledgerRepository.listAccounts(ctx),
      this.ledgerRepository.listPostedLedgerLinesUntil(ctx, range.endsOn)
    ]);
    const report = this.engine.generateBalanceSheet(range, accounts, lines);
    await this.audit(ctx, "BALANCE_SHEET", range);
    return report;
  }

  async generateCashFlow(command: ReportCommand) {
    const ctx = this.contextFrom(command);
    const range = await this.resolveRange(ctx, command);
    const [accounts, openingLines, periodLines] = await Promise.all([
      this.ledgerRepository.listAccounts(ctx),
      this.ledgerRepository.listPostedLedgerLinesUntil(ctx, this.dayBefore(range.startsOn)),
      this.ledgerRepository.listPostedLedgerLines(ctx, range.startsOn, range.endsOn)
    ]);
    const report = this.engine.generateCashFlow(range, accounts, openingLines, periodLines);
    await this.audit(ctx, "CASH_FLOW", range);
    return report;
  }

  private async resolveRange(ctx: TenantContext, command: ReportCommand): Promise<ReportDateRange> {
    if (command.fiscalPeriodId) {
      const period = await this.reportingRepository.findFiscalPeriod(ctx, command.fiscalPeriodId);
      if (!period) throw new ReportingError("FISCAL_PERIOD_NOT_FOUND", "Fiscal period was not found for this business.", { fiscalPeriodId: command.fiscalPeriodId });
      return { businessId: ctx.businessId, startsOn: period.startsOn, endsOn: period.endsOn, fiscalPeriodId: period.id };
    }

    if (!command.startsOn || !command.endsOn) {
      throw new ReportingError("REPORT_DATE_RANGE_REQUIRED", "Report requires either fiscalPeriodId or startsOn/endsOn.");
    }

    if (command.startsOn > command.endsOn) {
      throw new ReportingError("INVALID_REPORT_DATE_RANGE", "Report start date must be before or equal to end date.");
    }

    return { businessId: ctx.businessId, startsOn: command.startsOn, endsOn: command.endsOn };
  }

  private async audit(ctx: TenantContext, reportType: string, range: ReportDateRange): Promise<void> {
    await this.reportingRepository.createAuditLog(ctx, {
      action: "REPORT_GENERATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "report",
      metadata: {
        reportType,
        startsOn: range.startsOn.toISOString(),
        endsOn: range.endsOn.toISOString(),
        fiscalPeriodId: range.fiscalPeriodId
      }
    });
  }

  private dayBefore(date: Date): Date {
    return new Date(date.getTime() - 24 * 60 * 60 * 1000);
  }

  private contextFrom(command: ReportCommand): TenantContext {
    const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;
    return ctx;
  }
}
