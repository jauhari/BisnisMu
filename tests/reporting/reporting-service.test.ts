import { describe, expect, it } from "vitest";
import { FiscalPeriodEntity } from "../../src/features/business/domain/business-types";
import { LedgerRepository, ReportAuditEvent, ReportingRepository } from "../../src/features/reporting/application/reporting-repository";
import { ReportingService } from "../../src/features/reporting/application/reporting-service";
import { ReportingEngine } from "../../src/features/reporting/domain/reporting-engine";
import { LedgerLineSource, ReportAccount, TenantContext } from "../../src/features/reporting/domain/reporting-types";

const accounts: ReportAccount[] = [
  { id: "cash", businessId: "biz-1", code: "110101", name: "Kas", groupCode: 1, normalBalance: "DEBIT", subtype: "cash", isActive: true },
  { id: "bank", businessId: "biz-1", code: "110102", name: "Bank", groupCode: 1, normalBalance: "DEBIT", subtype: "bank", isActive: true },
  { id: "fixedAsset", businessId: "biz-1", code: "130101", name: "Peralatan", groupCode: 1, normalBalance: "DEBIT", subtype: "fixed_asset", isActive: true },
  { id: "payable", businessId: "biz-1", code: "210101", name: "Utang Usaha", groupCode: 2, normalBalance: "CREDIT", subtype: "accounts_payable", isActive: true },
  { id: "loan", businessId: "biz-1", code: "220101", name: "Pinjaman Bank", groupCode: 2, normalBalance: "CREDIT", subtype: "loan", isActive: true },
  { id: "capital", businessId: "biz-1", code: "310101", name: "Modal", groupCode: 3, normalBalance: "CREDIT", isActive: true },
  { id: "revenue", businessId: "biz-1", code: "410101", name: "Penjualan", groupCode: 4, normalBalance: "CREDIT", isActive: true },
  { id: "cogs", businessId: "biz-1", code: "510101", name: "HPP", groupCode: 5, normalBalance: "DEBIT", isActive: true },
  { id: "expense", businessId: "biz-1", code: "610201", name: "Beban Sewa", groupCode: 6, normalBalance: "DEBIT", isActive: true },
  { id: "otherExpense", businessId: "biz-1", code: "710101", name: "Beban Bunga", groupCode: 7, normalBalance: "DEBIT", isActive: true },
  { id: "tenant2cash", businessId: "biz-2", code: "110101", name: "Kas Tenant 2", groupCode: 1, normalBalance: "DEBIT", subtype: "cash", isActive: true }
];

function line(input: Omit<LedgerLineSource, "id" | "businessId" | "accountCode" | "accountName" | "accountGroupCode" | "accountNormalBalance" | "lineNo"> & { accountId: string; businessId?: string; lineNo?: number }): LedgerLineSource {
  const account = accounts.find((a) => a.id === input.accountId)!;
  return {
    id: input.journalId + "-" + input.accountId + "-" + (input.lineNo ?? 1),
    businessId: input.businessId ?? account.businessId,
    journalId: input.journalId,
    journalNumber: input.journalNumber,
    transactionDate: input.transactionDate,
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    accountGroupCode: account.groupCode,
    accountNormalBalance: account.normalBalance,
    description: input.description,
    source: input.source,
    ...(input.sourceId !== undefined && input.sourceId !== null ? { sourceId: input.sourceId } : {}),
    side: input.side,
    amount: input.amount,
    lineNo: input.lineNo ?? 1
  };
}

const lines: LedgerLineSource[] = [
  line({ journalId: "j-opening", journalNumber: "JV-0001", transactionDate: new Date("2026-01-01T00:00:00.000Z"), accountId: "cash", description: "Saldo awal", source: "BEGINNING_BALANCE", side: "DEBIT", amount: 1000n, lineNo: 1 }),
  line({ journalId: "j-opening", journalNumber: "JV-0001", transactionDate: new Date("2026-01-01T00:00:00.000Z"), accountId: "capital", description: "Saldo awal", source: "BEGINNING_BALANCE", side: "CREDIT", amount: 1000n, lineNo: 2 }),
  line({ journalId: "j-sale", journalNumber: "JV-0002", transactionDate: new Date("2026-02-01T00:00:00.000Z"), accountId: "cash", description: "Cash in", source: "CASH_IN", side: "DEBIT", amount: 500n, lineNo: 1 }),
  line({ journalId: "j-sale", journalNumber: "JV-0002", transactionDate: new Date("2026-02-01T00:00:00.000Z"), accountId: "revenue", description: "Cash in", source: "CASH_IN", side: "CREDIT", amount: 500n, lineNo: 2 }),
  line({ journalId: "j-cogs", journalNumber: "JV-0003", transactionDate: new Date("2026-02-02T00:00:00.000Z"), accountId: "cogs", description: "HPP", source: "JOURNAL", side: "DEBIT", amount: 100n, lineNo: 1 }),
  line({ journalId: "j-cogs", journalNumber: "JV-0003", transactionDate: new Date("2026-02-02T00:00:00.000Z"), accountId: "cash", description: "HPP", source: "JOURNAL", side: "CREDIT", amount: 100n, lineNo: 2 }),
  line({ journalId: "j-rent", journalNumber: "JV-0004", transactionDate: new Date("2026-03-01T00:00:00.000Z"), accountId: "expense", description: "Cash out", source: "CASH_OUT", side: "DEBIT", amount: 200n, lineNo: 1 }),
  line({ journalId: "j-rent", journalNumber: "JV-0004", transactionDate: new Date("2026-03-01T00:00:00.000Z"), accountId: "cash", description: "Cash out", source: "CASH_OUT", side: "CREDIT", amount: 200n, lineNo: 2 }),
  line({ journalId: "j-interest", journalNumber: "JV-0005", transactionDate: new Date("2026-03-02T00:00:00.000Z"), accountId: "otherExpense", description: "Bunga", source: "JOURNAL", side: "DEBIT", amount: 50n, lineNo: 1 }),
  line({ journalId: "j-interest", journalNumber: "JV-0005", transactionDate: new Date("2026-03-02T00:00:00.000Z"), accountId: "cash", description: "Bunga", source: "JOURNAL", side: "CREDIT", amount: 50n, lineNo: 2 }),
  line({ journalId: "j-tenant2", journalNumber: "JV-X", transactionDate: new Date("2026-02-01T00:00:00.000Z"), accountId: "tenant2cash", businessId: "biz-2", description: "Other tenant", source: "CASH_IN", side: "DEBIT", amount: 999n })
];

class InMemoryReportingRepository implements ReportingRepository, LedgerRepository {
  auditEvents: ReportAuditEvent[] = [];
  fiscalPeriod: FiscalPeriodEntity = { id: "period-2026", businessId: "biz-1", name: "2026", fiscalYear: 2026, startsOn: new Date("2026-01-01T00:00:00.000Z"), endsOn: new Date("2026-12-31T00:00:00.000Z"), status: "CLOSED", isClosed: true };
  constructor(private readonly sourceLines = lines) {}
  async findFiscalPeriod(ctx: TenantContext, id: string) { return ctx.businessId === this.fiscalPeriod.businessId && id === this.fiscalPeriod.id ? this.fiscalPeriod : null; }
  async createAuditLog(_ctx: TenantContext, event: ReportAuditEvent) { this.auditEvents.push(event); }
  async listAccounts(ctx: TenantContext) { return accounts.filter((account) => account.businessId === ctx.businessId); }
  async listPostedLedgerLines(ctx: TenantContext, startsOn: Date, endsOn: Date) { return this.sourceLines.filter((line) => line.businessId === ctx.businessId && line.transactionDate >= startsOn && line.transactionDate <= endsOn); }
  async listPostedLedgerLinesUntil(ctx: TenantContext, endsOn: Date) { return this.sourceLines.filter((line) => line.businessId === ctx.businessId && line.transactionDate <= endsOn); }
}

const command = { businessId: "biz-1", actorUserId: "user-1", startsOn: new Date("2026-01-01T00:00:00.000Z"), endsOn: new Date("2026-12-31T00:00:00.000Z") };

describe("ReportingService", () => {
  it("calculates general ledger running balances including beginning balance and cash transactions", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateGeneralLedger(command);
    const cash = report.accounts.find((account) => account.accountId === "cash")!;
    expect(cash.openingBalance).toBe(0n);
    expect(cash.periodDebit).toBe(1500n);
    expect(cash.periodCredit).toBe(350n);
    expect(cash.entries.map((entry) => entry.runningBalance)).toEqual([1000n, 1500n, 1400n, 1200n, 1150n]);
    expect(cash.closingBalance).toBe(1150n);
  });

  it("projects general ledger balances from opening lines and date-filtered period lines", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateGeneralLedger({
      businessId: "biz-1",
      actorUserId: "user-1",
      startsOn: new Date("2026-02-01T00:00:00.000Z"),
      endsOn: new Date("2026-02-28T00:00:00.000Z")
    });

    const cash = report.accounts.find((account) => account.accountId === "cash")!;
    expect(cash.openingBalance).toBe(1000n);
    expect(cash.periodDebit).toBe(500n);
    expect(cash.periodCredit).toBe(100n);
    expect(cash.closingBalance).toBe(1400n);
    expect(cash.entries.map((entry) => entry.journalNumber)).toEqual(["JV-0002", "JV-0003"]);
  });

  it("validates trial balance debit equals credit", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateTrialBalance(command);
    expect(report.totalDebit).toBe(1500n);
    expect(report.totalCredit).toBe(1500n);
    expect(report.isBalanced).toBe(true);
  });

  it("supports fiscal period filtering for trial balance", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateTrialBalance({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: "period-2026" });
    expect(report.startsOn.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(report.endsOn.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(report.totalDebit).toBe(report.totalCredit);
    expect(repo.auditEvents.at(-1)?.metadata.reportType).toBe("TRIAL_BALANCE");
  });

  it("places opposite-side account balances in the opposite debit or credit column", () => {
    const engine = new ReportingEngine();
    const report = engine.generateTrialBalance(
      { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
      accounts.filter((account) => account.businessId === "biz-1"),
      [
        line({ journalId: "j-reversal", journalNumber: "JV-0100", transactionDate: new Date("2026-04-01T00:00:00.000Z"), accountId: "revenue", description: "Revenue reversal", source: "ADJUSTMENT", side: "DEBIT", amount: 75n, lineNo: 1 }),
        line({ journalId: "j-reversal", journalNumber: "JV-0100", transactionDate: new Date("2026-04-01T00:00:00.000Z"), accountId: "cash", description: "Revenue reversal", source: "ADJUSTMENT", side: "CREDIT", amount: 75n, lineNo: 2 })
      ]
    );

    const revenue = report.rows.find((row) => row.accountId === "revenue")!;
    const cash = report.rows.find((row) => row.accountId === "cash")!;
    expect(revenue.debit).toBe(75n);
    expect(revenue.credit).toBe(0n);
    expect(cash.debit).toBe(0n);
    expect(cash.credit).toBe(75n);
    expect(report.totalDebit).toBe(75n);
    expect(report.totalCredit).toBe(75n);
  });

  it("calculates income statement sections according to SAK EMKM groups", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateIncomeStatement(command);
    expect(report.revenue.total).toBe(500n);
    expect(report.cogs.total).toBe(100n);
    expect(report.expenses.total).toBe(200n);
    expect(report.otherExpenses.total).toBe(50n);
    expect(report.netIncome).toBe(150n);
  });

  it("calculates profit and loss from revenue and expense accounts", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateProfitAndLoss(command);
    expect(report.revenue.lines.map((row) => row.accountId)).toEqual(["revenue"]);
    expect(report.cogs.lines.map((row) => row.accountId)).toEqual(["cogs"]);
    expect(report.expenses.lines.map((row) => row.accountId)).toEqual(["expense"]);
    expect(report.otherExpenses.lines.map((row) => row.accountId)).toEqual(["otherExpense"]);
    expect(report.revenue.total).toBe(500n);
    expect(report.cogs.total).toBe(100n);
    expect(report.expenses.total).toBe(200n);
    expect(report.otherExpenses.total).toBe(50n);
    expect(report.grossProfit).toBe(400n);
    expect(report.netIncome).toBe(150n);
    expect(repo.auditEvents.at(-1)?.metadata.reportType).toBe("PROFIT_AND_LOSS");
  });

  it("filters profit and loss by explicit date range", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateProfitAndLoss({
      businessId: "biz-1",
      actorUserId: "user-1",
      startsOn: new Date("2026-02-01T00:00:00.000Z"),
      endsOn: new Date("2026-02-28T00:00:00.000Z")
    });
    expect(report.revenue.total).toBe(500n);
    expect(report.cogs.total).toBe(100n);
    expect(report.expenses.total).toBe(0n);
    expect(report.otherExpenses.total).toBe(0n);
    expect(report.grossProfit).toBe(400n);
    expect(report.netIncome).toBe(400n);
  });

  it("supports fiscal period filtering for profit and loss", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateProfitAndLoss({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: "period-2026" });
    expect(report.startsOn.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(report.endsOn.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(report.netIncome).toBe(150n);
    expect(repo.auditEvents.at(-1)?.metadata.reportType).toBe("PROFIT_AND_LOSS");
  });

  it("validates balance sheet assets equal liabilities plus equity", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateBalanceSheet(command);
    expect(report.assets.lines.map((row) => row.accountId)).toEqual(["cash"]);
    expect(report.liabilities.lines).toEqual([]);
    expect(report.equity.lines.map((row) => row.accountId)).toEqual(["capital", "current-period-earnings"]);
    expect(report.retainedEarnings.amount).toBe(0n);
    expect(report.currentPeriodEarnings.amount).toBe(150n);
    expect(report.totalAssets).toBe(1150n);
    expect(report.totalLiabilitiesAndEquity).toBe(1150n);
    expect(report.isBalanced).toBe(true);
  });

  it("calculates balance sheet assets liabilities equity and retained earnings", async () => {
    const sourceLines = [
      line({ journalId: "j-prior-sale", journalNumber: "JV-2025-001", transactionDate: new Date("2025-12-01T00:00:00.000Z"), accountId: "cash", description: "Prior sale", source: "REVENUE", side: "DEBIT", amount: 300n, lineNo: 1 }),
      line({ journalId: "j-prior-sale", journalNumber: "JV-2025-001", transactionDate: new Date("2025-12-01T00:00:00.000Z"), accountId: "revenue", description: "Prior sale", source: "REVENUE", side: "CREDIT", amount: 300n, lineNo: 2 }),
      line({ journalId: "j-prior-expense", journalNumber: "JV-2025-002", transactionDate: new Date("2025-12-15T00:00:00.000Z"), accountId: "expense", description: "Prior expense", source: "EXPENSE", side: "DEBIT", amount: 80n, lineNo: 1 }),
      line({ journalId: "j-prior-expense", journalNumber: "JV-2025-002", transactionDate: new Date("2025-12-15T00:00:00.000Z"), accountId: "cash", description: "Prior expense", source: "EXPENSE", side: "CREDIT", amount: 80n, lineNo: 2 }),
      ...lines.filter((row) => row.businessId === "biz-1"),
      line({ journalId: "j-current-payable", journalNumber: "JV-2026-010", transactionDate: new Date("2026-04-01T00:00:00.000Z"), accountId: "expense", description: "Unpaid expense", source: "BILL", side: "DEBIT", amount: 60n, lineNo: 1 }),
      line({ journalId: "j-current-payable", journalNumber: "JV-2026-010", transactionDate: new Date("2026-04-01T00:00:00.000Z"), accountId: "payable", description: "Unpaid expense", source: "BILL", side: "CREDIT", amount: 60n, lineNo: 2 })
    ];

    const repo = new InMemoryReportingRepository(sourceLines);
    const report = await new ReportingService(repo, repo).generateBalanceSheet(command);
    expect(report.assets.total).toBe(1370n);
    expect(report.liabilities.total).toBe(60n);
    expect(report.equity.lines.map((row) => row.accountId)).toEqual(["capital", "retained-earnings", "current-period-earnings"]);
    expect(report.retainedEarnings.amount).toBe(220n);
    expect(report.currentPeriodEarnings.amount).toBe(90n);
    expect(report.equity.total).toBe(1310n);
    expect(report.totalAssets).toBe(1370n);
    expect(report.totalLiabilitiesAndEquity).toBe(1370n);
    expect(report.isBalanced).toBe(true);
  });

  it("classifies cash flow into operating investing and financing activities", async () => {
    const sourceLines = [
      ...lines.filter((row) => row.businessId === "biz-1"),
      line({ journalId: "j-buy-equipment", journalNumber: "JV-CF-001", transactionDate: new Date("2026-04-01T00:00:00.000Z"), accountId: "fixedAsset", description: "Buy equipment", source: "FIXED_ASSET", side: "DEBIT", amount: 250n, lineNo: 1 }),
      line({ journalId: "j-buy-equipment", journalNumber: "JV-CF-001", transactionDate: new Date("2026-04-01T00:00:00.000Z"), accountId: "cash", description: "Buy equipment", source: "FIXED_ASSET", side: "CREDIT", amount: 250n, lineNo: 2 }),
      line({ journalId: "j-loan", journalNumber: "JV-CF-002", transactionDate: new Date("2026-04-02T00:00:00.000Z"), accountId: "cash", description: "Loan proceeds", source: "LOAN", side: "DEBIT", amount: 400n, lineNo: 1 }),
      line({ journalId: "j-loan", journalNumber: "JV-CF-002", transactionDate: new Date("2026-04-02T00:00:00.000Z"), accountId: "loan", description: "Loan proceeds", source: "LOAN", side: "CREDIT", amount: 400n, lineNo: 2 }),
      line({ journalId: "j-cash-transfer", journalNumber: "JV-CF-003", transactionDate: new Date("2026-04-03T00:00:00.000Z"), accountId: "bank", description: "Cash transfer", source: "TRANSFER", side: "DEBIT", amount: 100n, lineNo: 1 }),
      line({ journalId: "j-cash-transfer", journalNumber: "JV-CF-003", transactionDate: new Date("2026-04-03T00:00:00.000Z"), accountId: "cash", description: "Cash transfer", source: "TRANSFER", side: "CREDIT", amount: 100n, lineNo: 2 })
    ];

    const repo = new InMemoryReportingRepository(sourceLines);
    const report = await new ReportingService(repo, repo).generateCashFlow(command);
    expect(report.beginningCashBalance).toBe(0n);
    expect(report.operatingActivities.total).toBe(150n);
    expect(report.investingActivities.total).toBe(-250n);
    expect(report.financingActivities.total).toBe(1400n);
    expect(report.netCashChange).toBe(1300n);
    expect(report.endingCashBalance).toBe(1300n);
    expect(report.operatingActivities.lines.map((row) => row.accountId)).toEqual(["revenue", "cogs", "expense", "otherExpense"]);
    expect(report.investingActivities.lines.map((row) => row.accountId)).toEqual(["fixedAsset"]);
    expect(report.financingActivities.lines.map((row) => row.accountId)).toEqual(["loan", "capital"]);
    expect(repo.auditEvents.at(-1)?.metadata.reportType).toBe("CASH_FLOW");
  });

  it("calculates cash flow beginning and ending cash with date range filtering", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateCashFlow({
      businessId: "biz-1",
      actorUserId: "user-1",
      startsOn: new Date("2026-02-01T00:00:00.000Z"),
      endsOn: new Date("2026-02-28T00:00:00.000Z")
    });
    expect(report.beginningCashBalance).toBe(1000n);
    expect(report.operatingActivities.total).toBe(400n);
    expect(report.investingActivities.total).toBe(0n);
    expect(report.financingActivities.total).toBe(0n);
    expect(report.netCashChange).toBe(400n);
    expect(report.endingCashBalance).toBe(1400n);
  });

  it("supports fiscal period filtering for cash flow", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateCashFlow({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: "period-2026" });
    expect(report.startsOn.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(report.endsOn.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(report.operatingActivities.total).toBe(150n);
    expect(report.financingActivities.total).toBe(1000n);
    expect(report.endingCashBalance).toBe(1150n);
  });

  it("supports fiscal period filtering for closed periods", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateIncomeStatement({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: "period-2026" });
    expect(report.endsOn.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(repo.auditEvents.at(-1)?.metadata.reportType).toBe("INCOME_STATEMENT");
  });

  it("keeps reports tenant isolated", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateGeneralLedger(command);
    expect(report.businessId).toBe("biz-1");
    expect(report.accounts.some((account) => account.accountId === "tenant2cash")).toBe(false);
  });

  it("keeps trial balance tenant isolated through repository business filtering", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateTrialBalance(command);
    expect(report.businessId).toBe("biz-1");
    expect(report.rows.some((row) => row.accountId === "tenant2cash")).toBe(false);
  });

  it("keeps profit and loss tenant isolated through repository business filtering", async () => {
    const repo = new InMemoryReportingRepository([
      ...lines,
      line({ journalId: "j-tenant2-revenue", journalNumber: "JV-X2", transactionDate: new Date("2026-03-01T00:00:00.000Z"), accountId: "tenant2cash", businessId: "biz-2", description: "Other tenant revenue", source: "CASH_IN", side: "DEBIT", amount: 999n })
    ]);
    const report = await new ReportingService(repo, repo).generateProfitAndLoss(command);
    expect(report.businessId).toBe("biz-1");
    expect(report.revenue.total).toBe(500n);
  });

  it("keeps balance sheet tenant isolated through repository business filtering", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateBalanceSheet(command);
    expect(report.businessId).toBe("biz-1");
    expect(report.assets.lines.some((row) => row.accountId === "tenant2cash")).toBe(false);
  });

  it("keeps cash flow tenant isolated through repository business filtering", async () => {
    const repo = new InMemoryReportingRepository();
    const report = await new ReportingService(repo, repo).generateCashFlow(command);
    expect(report.businessId).toBe("biz-1");
    expect(report.endingCashBalance).toBe(1150n);
  });

  it("rejects general ledger input containing accounts from another tenant", () => {
    const engine = new ReportingEngine();
    expect(() =>
      engine.generateGeneralLedger(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts,
        [],
        []
      )
    ).toThrow(/another business/i);
  });

  it("rejects general ledger lines from another tenant for a requested account", () => {
    const engine = new ReportingEngine();
    const foreignLine = line({
      journalId: "j-foreign",
      journalNumber: "JV-FOREIGN",
      transactionDate: new Date("2026-02-01T00:00:00.000Z"),
      accountId: "cash",
      businessId: "biz-2",
      description: "Foreign tenant line",
      source: "JOURNAL",
      side: "DEBIT",
      amount: 100n
    });

    expect(() =>
      engine.generateGeneralLedger(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts.filter((account) => account.businessId === "biz-1"),
        [],
        [foreignLine]
      )
    ).toThrow(/another business/i);
  });

  it("rejects trial balance input containing accounts from another tenant", () => {
    const engine = new ReportingEngine();
    expect(() =>
      engine.generateTrialBalance(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts,
        []
      )
    ).toThrow(/another business/i);
  });

  it("rejects trial balance lines from another tenant for a requested account", () => {
    const engine = new ReportingEngine();
    const foreignLine = line({
      journalId: "j-foreign-tb",
      journalNumber: "JV-FOREIGN-TB",
      transactionDate: new Date("2026-02-01T00:00:00.000Z"),
      accountId: "cash",
      businessId: "biz-2",
      description: "Foreign tenant trial balance line",
      source: "JOURNAL",
      side: "DEBIT",
      amount: 100n
    });

    expect(() =>
      engine.generateTrialBalance(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts.filter((account) => account.businessId === "biz-1"),
        [foreignLine]
      )
    ).toThrow(/another business/i);
  });

  it("rejects profit and loss input containing accounts from another tenant", () => {
    const engine = new ReportingEngine();
    expect(() =>
      engine.generateProfitAndLoss(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts,
        []
      )
    ).toThrow(/another business/i);
  });

  it("rejects profit and loss lines from another tenant for a requested account", () => {
    const engine = new ReportingEngine();
    const foreignLine = line({
      journalId: "j-foreign-pl",
      journalNumber: "JV-FOREIGN-PL",
      transactionDate: new Date("2026-02-01T00:00:00.000Z"),
      accountId: "revenue",
      businessId: "biz-2",
      description: "Foreign tenant profit and loss line",
      source: "JOURNAL",
      side: "CREDIT",
      amount: 100n
    });

    expect(() =>
      engine.generateProfitAndLoss(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts.filter((account) => account.businessId === "biz-1"),
        [foreignLine]
      )
    ).toThrow(/another business/i);
  });

  it("rejects balance sheet input containing accounts from another tenant", () => {
    const engine = new ReportingEngine();
    expect(() =>
      engine.generateBalanceSheet(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts,
        []
      )
    ).toThrow(/another business/i);
  });

  it("rejects balance sheet lines from another tenant for a requested account", () => {
    const engine = new ReportingEngine();
    const foreignLine = line({
      journalId: "j-foreign-bs",
      journalNumber: "JV-FOREIGN-BS",
      transactionDate: new Date("2026-02-01T00:00:00.000Z"),
      accountId: "cash",
      businessId: "biz-2",
      description: "Foreign tenant balance sheet line",
      source: "JOURNAL",
      side: "DEBIT",
      amount: 100n
    });

    expect(() =>
      engine.generateBalanceSheet(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts.filter((account) => account.businessId === "biz-1"),
        [foreignLine]
      )
    ).toThrow(/another business/i);
  });

  it("rejects cash flow input containing accounts from another tenant", () => {
    const engine = new ReportingEngine();
    expect(() =>
      engine.generateCashFlow(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts,
        [],
        []
      )
    ).toThrow(/another business/i);
  });

  it("rejects cash flow lines from another tenant for a requested account", () => {
    const engine = new ReportingEngine();
    const foreignLine = line({
      journalId: "j-foreign-cf",
      journalNumber: "JV-FOREIGN-CF",
      transactionDate: new Date("2026-02-01T00:00:00.000Z"),
      accountId: "cash",
      businessId: "biz-2",
      description: "Foreign tenant cash flow line",
      source: "JOURNAL",
      side: "DEBIT",
      amount: 100n
    });

    expect(() =>
      engine.generateCashFlow(
        { businessId: "biz-1", startsOn: command.startsOn, endsOn: command.endsOn },
        accounts.filter((account) => account.businessId === "biz-1"),
        [],
        [foreignLine]
      )
    ).toThrow(/another business/i);
  });

  it("throws when trial balance is unbalanced", async () => {
    const broken = lines.filter((line) => !(line.journalId === "j-sale" && line.accountId === "revenue"));
    const repo = new InMemoryReportingRepository(broken);
    await expect(new ReportingService(repo, repo).generateTrialBalance(command)).rejects.toThrow(/debit total must equal credit total/i);
  });
});
