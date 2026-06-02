import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { BusinessEngine } from "../domain/business-engine";
import { BusinessDomainError, TenantContext } from "../domain/business-types";
import { BusinessRepository, CloseFiscalPeriodCommand, CreateBusinessCommand, OpenFiscalPeriodCommand, PostBeginningBalancesCommand, ReopenFiscalPeriodCommand, SaveBeginningBalancesCommand, UpdateBusinessSettingsCommand } from "./business-repository";

export class BusinessService {
  constructor(private readonly repository: BusinessRepository, private readonly journalPostingService: JournalPostingService, private readonly engine = new BusinessEngine()) {}

  async createBusiness(command: CreateBusinessCommand) {
    const validated = this.engine.validateCreateBusiness(command);
    const business = await this.repository.createBusiness(command.actorUserId, validated);
    const ctx = this.contextFrom({ ...command, businessId: business.id });
    await this.repository.createAuditLog(ctx, {
      action: "BUSINESS_CREATED", businessId: business.id, actorUserId: command.actorUserId, entityType: "business", entityId: business.id,
      metadata: { name: business.name, type: business.type, fiscalYearStart: business.fiscalYearStart, currency: business.currency }
    });
    return business;
  }

  async updateSettings(command: UpdateBusinessSettingsCommand) {
    const ctx = this.contextFrom(command);
    this.engine.validateSettings(command);
    const business = await this.repository.updateBusinessSettings(ctx, command);
    await this.repository.createAuditLog(ctx, { action: "BUSINESS_SETTINGS_UPDATED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "business", entityId: business.id, metadata: { name: business.name, fiscalYearStart: business.fiscalYearStart } });
    return business;
  }

  async openFiscalPeriod(command: OpenFiscalPeriodCommand) {
    const ctx = this.contextFrom(command);
    const business = await this.repository.findBusiness(ctx);
    if (!business) throw new BusinessDomainError("BUSINESS_NOT_FOUND", "Business was not found.");
    const existing = await this.repository.findFiscalPeriodByYear(ctx, command.fiscalYear);
    if (existing) throw new BusinessDomainError("FISCAL_PERIOD_ALREADY_EXISTS", "Fiscal period already exists for this fiscal year.", { fiscalYear: command.fiscalYear });
    const dates = this.engine.buildFiscalPeriod(command.fiscalYear, business.fiscalYearStart);
    const period = await this.repository.createFiscalPeriod(ctx, { fiscalYear: command.fiscalYear, ...dates });
    await this.repository.createAuditLog(ctx, { action: "FISCAL_PERIOD_OPENED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "fiscal_period", entityId: period.id, metadata: { fiscalYear: period.fiscalYear, startsOn: period.startsOn.toISOString(), endsOn: period.endsOn.toISOString() } });
    return period;
  }

  async closeFiscalPeriod(command: CloseFiscalPeriodCommand) {
    const ctx = this.contextFrom(command);
    this.engine.validateClosePeriod(await this.repository.findFiscalPeriod(ctx, command.fiscalPeriodId));
    const period = await this.repository.closeFiscalPeriod(ctx, command.fiscalPeriodId);
    await this.repository.createAuditLog(ctx, { action: "FISCAL_PERIOD_CLOSED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "fiscal_period", entityId: period.id, metadata: { fiscalYear: period.fiscalYear, closedAt: period.closedAt?.toISOString() } });
    return period;
  }

  async reopenFiscalPeriod(command: ReopenFiscalPeriodCommand) {
    const ctx = this.contextFrom(command);
    this.engine.validateReopenPeriod(command, await this.repository.findFiscalPeriod(ctx, command.fiscalPeriodId));
    const period = await this.repository.reopenFiscalPeriod(ctx, command.fiscalPeriodId, command.reason.trim());
    await this.repository.createAuditLog(ctx, { action: "FISCAL_PERIOD_REOPENED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "fiscal_period", entityId: period.id, metadata: { fiscalYear: period.fiscalYear, reason: command.reason.trim(), reopenedAt: period.reopenedAt?.toISOString() } });
    return period;
  }

  async saveBeginningBalances(command: SaveBeginningBalancesCommand) {
    const ctx = this.contextFrom(command);
    const period = await this.repository.findFiscalPeriod(ctx, command.fiscalPeriodId);
    if (!period) throw new BusinessDomainError("FISCAL_PERIOD_NOT_FOUND", "Fiscal period was not found.");
    const accountIds = [...new Set(command.lines.map((line) => line.accountId))];
    const accounts = await this.repository.findAccountsForBeginningBalance(ctx, accountIds);
    this.engine.validateBeginningBalances(command.lines, { period, accounts });
    const saved = await this.repository.saveBeginningBalances(ctx, command.fiscalPeriodId, command.lines);
    await this.repository.createAuditLog(ctx, { action: "BEGINNING_BALANCE_SAVED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "beginning_balance", metadata: { fiscalPeriodId: command.fiscalPeriodId, lineCount: saved.length } });
    return saved;
  }

  async postBeginningBalances(command: PostBeginningBalancesCommand) {
    const ctx = this.contextFrom(command);
    const period = await this.repository.findFiscalPeriod(ctx, command.fiscalPeriodId);
    if (!period) throw new BusinessDomainError("FISCAL_PERIOD_NOT_FOUND", "Fiscal period was not found.");
    const balances = await this.repository.listBeginningBalances(ctx, command.fiscalPeriodId);
    const accountIds = [...new Set(balances.map((line) => line.accountId))];
    const accounts = await this.repository.findAccountsForBeginningBalance(ctx, accountIds);
    this.engine.validateBeginningBalances(balances, { period, accounts });
    const postCommand: PostJournalCommand = {
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      transactionDate: period.startsOn,
      source: "BEGINNING_BALANCE",
      sourceId: period.id,
      description: "Saldo awal periode " + period.name,
      idempotencyKey: "beginning-balance:" + ctx.businessId + ":" + period.id,
      lines: balances.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount, memo: "Saldo awal" }))
    };
    if (ctx.requestId !== undefined) postCommand.requestId = ctx.requestId;
    if (ctx.ipAddress !== undefined) postCommand.ipAddress = ctx.ipAddress;
    if (ctx.userAgent !== undefined) postCommand.userAgent = ctx.userAgent;
    const result = await this.journalPostingService.post(postCommand);
    await this.repository.markBeginningBalancesPosted(ctx, command.fiscalPeriodId, result.journalId);
    await this.repository.createAuditLog(ctx, { action: "BEGINNING_BALANCE_POSTED", businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "beginning_balance", entityId: result.journalId, metadata: { fiscalPeriodId: command.fiscalPeriodId, journalNumber: result.journalNumber } });
    return result;
  }

  private contextFrom(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext {
    const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;
    return ctx;
  }
}
