import { sumMinorUnits } from "../../accounting/domain/money";
import { BeginningBalanceLine, BeginningBalanceValidationContext, BusinessDomainError, CreateBusinessInput, FiscalPeriodEntity, ReopenFiscalPeriodInput, UpdateBusinessSettingsInput } from "./business-types";
import { fiscalPeriodDates } from "./fiscal-year";

const BUSINESS_TYPES = new Set(["UMKM", "BUMDES", "PERORANGAN", "CV", "UD"]);

export class BusinessEngine {
  validateCreateBusiness(input: CreateBusinessInput): CreateBusinessInput & { name: string; currency: "IDR"; fiscalYearStart: number } {
    this.assertBusinessName(input.name);
    if (!BUSINESS_TYPES.has(input.type)) throw new BusinessDomainError("INVALID_BUSINESS_TYPE", "Business type is not supported.", { type: input.type });
    const fiscalYearStart = input.fiscalYearStart ?? 1;
    this.assertFiscalYearStart(fiscalYearStart);
    this.assertCurrency(input.currency ?? "IDR");
    return { ...input, name: input.name.trim(), currency: "IDR", fiscalYearStart };
  }

  validateSettings(input: UpdateBusinessSettingsInput): void {
    if (input.name !== undefined) this.assertBusinessName(input.name);
    if (input.fiscalYearStart !== undefined) this.assertFiscalYearStart(input.fiscalYearStart);
  }

  buildFiscalPeriod(fiscalYear: number, fiscalYearStart: number): { startsOn: Date; endsOn: Date; name: string } {
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      throw new BusinessDomainError("INVALID_FISCAL_YEAR", "Fiscal year must be between 2000 and 2100.", { fiscalYear });
    }
    this.assertFiscalYearStart(fiscalYearStart);
    return fiscalPeriodDates(fiscalYear, fiscalYearStart);
  }

  validateClosePeriod(period: FiscalPeriodEntity | null): FiscalPeriodEntity {
    if (!period) throw new BusinessDomainError("FISCAL_PERIOD_NOT_FOUND", "Fiscal period was not found.");
    if (period.isClosed || period.status === "CLOSED") throw new BusinessDomainError("FISCAL_PERIOD_ALREADY_CLOSED", "Fiscal period is already closed.", { fiscalPeriodId: period.id });
    return period;
  }

  validateReopenPeriod(input: ReopenFiscalPeriodInput, period: FiscalPeriodEntity | null): FiscalPeriodEntity {
    if (!period) throw new BusinessDomainError("FISCAL_PERIOD_NOT_FOUND", "Fiscal period was not found.");
    if (!period.isClosed || period.status !== "CLOSED") throw new BusinessDomainError("FISCAL_PERIOD_NOT_CLOSED", "Only closed fiscal periods can be reopened.", { fiscalPeriodId: period.id });
    if (input.reason.trim().length < 20) throw new BusinessDomainError("REOPEN_REASON_TOO_SHORT", "Reopening a fiscal period requires an audit reason of at least 20 characters.");
    return period;
  }

  validateBeginningBalances(lines: BeginningBalanceLine[], context: BeginningBalanceValidationContext): void {
    if (context.period.isClosed) throw new BusinessDomainError("FISCAL_PERIOD_CLOSED", "Cannot save beginning balances in a closed fiscal period.", { fiscalPeriodId: context.period.id });
    if (lines.length < 2) throw new BusinessDomainError("BEGINNING_BALANCE_MINIMUM", "Beginning balances must contain at least two lines.");

    const accountById = new Map(context.accounts.map((account) => [account.id, account]));
    for (const line of lines) {
      if (line.amount <= 0n) throw new BusinessDomainError("INVALID_BEGINNING_BALANCE_AMOUNT", "Beginning balance amount must be greater than zero.");
      const account = accountById.get(line.accountId);
      if (!account) throw new BusinessDomainError("ACCOUNT_NOT_FOUND", "Beginning balance account was not found in this business.", { accountId: line.accountId });
      if (account.businessId !== context.period.businessId) throw new BusinessDomainError("TENANT_ACCOUNT_MISMATCH", "Beginning balance account must belong to the same business.");
      if (!account.isActive || !account.isPostingAllowed) throw new BusinessDomainError("ACCOUNT_NOT_POSTABLE", "Beginning balance can only be entered for active posting accounts.", { accountId: account.id });
    }

    const debit = sumMinorUnits(lines.filter((line) => line.side === "DEBIT").map((line) => line.amount));
    const credit = sumMinorUnits(lines.filter((line) => line.side === "CREDIT").map((line) => line.amount));
    if (debit !== credit) throw new BusinessDomainError("BEGINNING_BALANCE_UNBALANCED", "Beginning balances must be balanced before posting.", { totalDebit: debit.toString(), totalCredit: credit.toString() });
  }

  private assertBusinessName(name: string): void {
    if (!name.trim()) throw new BusinessDomainError("BUSINESS_NAME_REQUIRED", "Business name is required.");
    if (name.trim().length > 120) throw new BusinessDomainError("BUSINESS_NAME_TOO_LONG", "Business name must be 120 characters or fewer.");
  }

  private assertFiscalYearStart(month: number): void {
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new BusinessDomainError("INVALID_FISCAL_YEAR_START", "Fiscal year start must be a month number from 1 to 12.", { fiscalYearStart: month });
  }

  private assertCurrency(currency: string): void {
    if (currency !== "IDR") throw new BusinessDomainError("UNSUPPORTED_CURRENCY", "SAK EMKM MVP supports IDR only.", { currency });
  }
}
