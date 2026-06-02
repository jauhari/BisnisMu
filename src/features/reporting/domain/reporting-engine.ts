import { AccountGroupCode, NormalBalance } from "../../accounting/domain/accounting-types";
import {
  BalanceSheetReport,
  CashFlowActivity,
  CashFlowLine,
  CashFlowReport,
  CashFlowSection,
  FloatReport,
  FloatReportInput,
  GeneralLedgerAccount,
  GeneralLedgerReport,
  IncomeStatementReport,
  InventoryReport,
  InventoryReportInput,
  LedgerEntry,
  LedgerLineSource,
  ProfitAndLossReport,
  PurchaseReport,
  PurchaseReportInput,
  ReportAccount,
  ReportDateRange,
  ReportingError,
  SalesReport,
  SalesReportInput,
  StatementLine,
  StatementSection,
  TrialBalanceReport,
  TrialBalanceRow
} from "./reporting-types";

export class ReportingEngine {
  generateProfitLoss(range: ReportDateRange, accounts: ReportAccount[], periodLines: LedgerLineSource[]): ProfitAndLossReport {
    return this.generateProfitAndLoss(range, accounts, periodLines);
  }

  generateGeneralLedger(range: ReportDateRange, accounts: ReportAccount[], openingLines: LedgerLineSource[], periodLines: LedgerLineSource[]): GeneralLedgerReport {
    this.assertAccountsBelongToTenant(range.businessId, accounts);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const openingByAccount = this.netByAccount(openingLines, accountsById);
    const linesByAccount = new Map<string, LedgerLineSource[]>();

    for (const line of periodLines) {
      this.assertTenant(range.businessId, line.businessId);
      if (!linesByAccount.has(line.accountId)) linesByAccount.set(line.accountId, []);
      linesByAccount.get(line.accountId)!.push(line);
    }

    const reportAccounts: GeneralLedgerAccount[] = accounts
      .filter((account) => openingByAccount.get(account.id) !== 0n || linesByAccount.has(account.id))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((account) => this.projectAccountLedger(account, openingByAccount.get(account.id) ?? 0n, linesByAccount.get(account.id) ?? []));

    return { businessId: range.businessId, startsOn: range.startsOn, endsOn: range.endsOn, accounts: reportAccounts };
  }

  generateTrialBalance(range: ReportDateRange, accounts: ReportAccount[], allLinesToDate: LedgerLineSource[]): TrialBalanceReport {
    this.assertAccountsBelongToTenant(range.businessId, accounts);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const netByAccount = this.netByAccount(allLinesToDate, accountsById);
    const rows: TrialBalanceRow[] = [];

    for (const account of accounts.sort((a, b) => a.code.localeCompare(b.code))) {
      const net = netByAccount.get(account.id) ?? 0n;
      if (net === 0n) continue;
      rows.push(this.trialBalanceRow(account, net));
    }

    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0n);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0n);
    const isBalanced = totalDebit === totalCredit;
    if (!isBalanced) throw new ReportingError("TRIAL_BALANCE_UNBALANCED", "Trial Balance debit total must equal credit total.", { totalDebit: totalDebit.toString(), totalCredit: totalCredit.toString() });
    return { businessId: range.businessId, startsOn: range.startsOn, endsOn: range.endsOn, rows, totalDebit, totalCredit, isBalanced };
  }

  generateProfitAndLoss(range: ReportDateRange, accounts: ReportAccount[], periodLines: LedgerLineSource[]): ProfitAndLossReport {
    return this.generateIncomeStatement(range, accounts, periodLines);
  }

  generateIncomeStatement(range: ReportDateRange, accounts: ReportAccount[], periodLines: LedgerLineSource[]): IncomeStatementReport {
    this.assertAccountsBelongToTenant(range.businessId, accounts);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const netByAccount = this.netByAccount(periodLines, accountsById);
    const revenue = this.section(accounts, netByAccount, [4]);
    const cogs = this.section(accounts, netByAccount, [5]);
    const expenses = this.section(accounts, netByAccount, [6]);
    const otherExpenses = this.section(accounts, netByAccount, [7]);
    const grossProfit = revenue.total - cogs.total;
    const netIncome = grossProfit - expenses.total - otherExpenses.total;
    return { businessId: range.businessId, startsOn: range.startsOn, endsOn: range.endsOn, revenue, cogs, expenses, otherExpenses, grossProfit, netIncome };
  }

  generateBalanceSheet(range: ReportDateRange, accounts: ReportAccount[], allLinesToDate: LedgerLineSource[]): BalanceSheetReport {
    this.assertAccountsBelongToTenant(range.businessId, accounts);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const netByAccount = this.netByAccount(allLinesToDate, accountsById);
    const retainedEarnings = this.earningsLine("retained-earnings", "390001", "Saldo Laba Ditahan", this.netIncomeForLines(range, accounts, allLinesToDate.filter((line) => this.isIncomeStatementLine(line) && line.transactionDate < range.startsOn)));
    const currentPeriodEarnings = this.earningsLine("current-period-earnings", "399999", "Laba (Rugi) Berjalan", this.netIncomeForLines(range, accounts, allLinesToDate.filter((line) => this.isIncomeStatementLine(line) && line.transactionDate >= range.startsOn && line.transactionDate <= range.endsOn)));
    const assets = this.section(accounts, netByAccount, [1]);
    const liabilities = this.section(accounts, netByAccount, [2]);
    const equity = this.section(accounts, netByAccount, [3]);
    if (retainedEarnings.amount !== 0n) equity.lines.push(retainedEarnings);
    if (currentPeriodEarnings.amount !== 0n) equity.lines.push(currentPeriodEarnings);
    equity.total = equity.lines.reduce((sum, line) => sum + line.amount, 0n);

    const totalAssets = assets.total;
    const totalLiabilitiesAndEquity = liabilities.total + equity.total;
    const isBalanced = totalAssets === totalLiabilitiesAndEquity;
    if (!isBalanced) throw new ReportingError("BALANCE_SHEET_UNBALANCED", "Balance Sheet must satisfy Assets = Liabilities + Equity.", { totalAssets: totalAssets.toString(), totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toString() });
    return { businessId: range.businessId, asOf: range.endsOn, assets, liabilities, equity, retainedEarnings, currentPeriodEarnings, totalAssets, totalLiabilitiesAndEquity, isBalanced };
  }

  generateCashFlow(range: ReportDateRange, accounts: ReportAccount[], openingLines: LedgerLineSource[], periodLines: LedgerLineSource[]): CashFlowReport {
    this.assertAccountsBelongToTenant(range.businessId, accounts);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const cashAccountIds = new Set(accounts.filter((account) => this.isCashAccount(account)).map((account) => account.id));
    const openingByAccount = this.netByAccount(openingLines, accountsById);
    const beginningCashBalance = [...cashAccountIds].reduce((sum, accountId) => sum + (openingByAccount.get(accountId) ?? 0n), 0n);
    const activityLines = new Map<string, CashFlowLine>();
    const linesByJournal = this.groupByJournal(periodLines);

    for (const lines of linesByJournal.values()) {
      for (const line of lines) this.assertTenant(range.businessId, line.businessId);

      const cashDelta = lines.reduce((sum, line) => {
        if (!cashAccountIds.has(line.accountId)) return sum;
        const account = accountsById.get(line.accountId);
        if (!account) return sum;
        return sum + this.signedAmount(line.side, line.amount, account.normalBalance);
      }, 0n);

      if (cashDelta === 0n) continue;

      const counterpart = this.primaryCounterparty(lines.filter((line) => !cashAccountIds.has(line.accountId)), accountsById);
      if (!counterpart) continue;

      const activity = this.cashFlowActivity(counterpart);
      const key = activity + ":" + counterpart.id;
      const existing = activityLines.get(key);
      if (existing) {
        existing.amount += cashDelta;
      } else {
        activityLines.set(key, {
          activity,
          accountId: counterpart.id,
          accountCode: counterpart.code,
          accountName: counterpart.name,
          amount: cashDelta
        });
      }
    }

    const operatingActivities = this.cashFlowSection("OPERATING", activityLines);
    const investingActivities = this.cashFlowSection("INVESTING", activityLines);
    const financingActivities = this.cashFlowSection("FINANCING", activityLines);
    const netCashChange = operatingActivities.total + investingActivities.total + financingActivities.total;

    return {
      businessId: range.businessId,
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      beginningCashBalance,
      operatingActivities,
      investingActivities,
      financingActivities,
      netCashChange,
      endingCashBalance: beginningCashBalance + netCashChange
    };
  }

  generateSalesReport(range: ReportDateRange, orders: SalesReportInput): SalesReport {
    const filtered = orders.filter((order) => this.inRangeForTenant(range, order.businessId, order.saleDate));
    const byStatus = {
      DRAFT: { count: 0, totalAmount: 0n, paidAmount: 0n },
      CONFIRMED: { count: 0, totalAmount: 0n, paidAmount: 0n },
      PARTIALLY_PAID: { count: 0, totalAmount: 0n, paidAmount: 0n },
      PAID: { count: 0, totalAmount: 0n, paidAmount: 0n },
      VOID: { count: 0, totalAmount: 0n, paidAmount: 0n }
    };

    let itemCount = 0n;
    let subtotal = 0n;
    let discountTotal = 0n;
    let taxTotal = 0n;
    let totalAmount = 0n;
    let paidAmount = 0n;

    for (const order of filtered) {
      itemCount += order.items.reduce((sum, item) => sum + item.quantity, 0n);
      subtotal += order.subtotal;
      discountTotal += order.discountTotal;
      taxTotal += order.taxTotal;
      totalAmount += order.totalAmount;
      paidAmount += order.paidAmount;
      byStatus[order.status].count += 1;
      byStatus[order.status].totalAmount += order.totalAmount;
      byStatus[order.status].paidAmount += order.paidAmount;
    }

    return { businessId: range.businessId, startsOn: range.startsOn, endsOn: range.endsOn, orderCount: filtered.length, itemCount, subtotal, discountTotal, taxTotal, totalAmount, paidAmount, outstandingAmount: totalAmount - paidAmount, byStatus };
  }

  generatePurchaseReport(range: ReportDateRange, input: PurchaseReportInput): PurchaseReport {
    const orders = input.orders.filter((order) => this.inRangeForTenant(range, order.businessId, order.orderDate));
    const receipts = (input.receipts ?? []).filter((receipt) => this.inRangeForTenant(range, receipt.businessId, receipt.receiptDate));
    const returns = (input.returns ?? []).filter((row) => this.inRangeForTenant(range, row.businessId, row.returnDate));
    const orderedAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0n);
    const receivedCost = receipts.reduce((sum, receipt) => sum + receipt.totalCost, 0n);
    const returnedCost = returns.reduce((sum, row) => sum + row.totalCost, 0n);
    return { businessId: range.businessId, startsOn: range.startsOn, endsOn: range.endsOn, orderCount: orders.length, receiptCount: receipts.length, returnCount: returns.length, orderedAmount, receivedCost, returnedCost, netReceivedCost: receivedCost - returnedCost };
  }

  generateInventoryReport(range: ReportDateRange, input: InventoryReportInput): InventoryReport {
    const products = (input.products ?? []).filter((product) => product.businessId === range.businessId);
    const balances = (input.balances ?? []).filter((balance) => balance.businessId === range.businessId);
    const movements = (input.movements ?? []).filter((movement) => this.inRangeForTenant(range, movement.businessId, movement.movementDate));
    const movementQuantityByType = this.inventoryMovementTotals();
    const movementCostByType = this.inventoryMovementTotals();

    for (const movement of movements) {
      movementQuantityByType[movement.type] += movement.quantity;
      movementCostByType[movement.type] += movement.totalCost;
    }

    return {
      businessId: range.businessId,
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      productCount: products.length,
      balanceQuantity: balances.reduce((sum, balance) => sum + balance.quantity, 0n),
      inventoryValue: balances.reduce((sum, balance) => sum + balance.inventoryValue, 0n),
      movementQuantityByType,
      movementCostByType
    };
  }

  generateFloatReport(range: ReportDateRange, input: FloatReportInput): FloatReport {
    const accounts = (input.accounts ?? []).filter((account) => account.businessId === range.businessId);
    const transactions = (input.transactions ?? []).filter((transaction) => this.inRangeForTenant(range, transaction.businessId, transaction.transactionDate));
    const snapshots = (input.snapshots ?? []).filter((snapshot) => this.inRangeForTenant(range, snapshot.businessId, snapshot.snapshotDate));
    const transactionAmountByType = { TOPUP: 0n, CONSUME: 0n, TRANSFER: 0n, ADJUSTMENT: 0n };

    for (const transaction of transactions) {
      transactionAmountByType[transaction.type] += transaction.amount;
    }

    const latestSnapshotByAccount = new Map<string, { snapshotDate: Date; balance: bigint }>();
    for (const snapshot of snapshots) {
      const existing = latestSnapshotByAccount.get(snapshot.floatAccountId);
      if (!existing || snapshot.snapshotDate > existing.snapshotDate) {
        latestSnapshotByAccount.set(snapshot.floatAccountId, { snapshotDate: snapshot.snapshotDate, balance: snapshot.balance });
      }
    }

    return {
      businessId: range.businessId,
      startsOn: range.startsOn,
      endsOn: range.endsOn,
      accountCount: accounts.length,
      currentBalance: accounts.reduce((sum, account) => sum + account.currentBalance, 0n),
      transactionAmountByType,
      snapshotCount: snapshots.length,
      latestSnapshotBalance: [...latestSnapshotByAccount.values()].reduce((sum, snapshot) => sum + snapshot.balance, 0n)
    };
  }

  private section(accounts: ReportAccount[], netByAccount: Map<string, bigint>, groups: AccountGroupCode[]): StatementSection {
    const lines: StatementLine[] = accounts
      .filter((account) => groups.includes(account.groupCode))
      .map((account) => ({ accountId: account.id, accountCode: account.code, accountName: account.name, amount: netByAccount.get(account.id) ?? 0n }))
      .filter((line) => line.amount !== 0n)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0n) };
  }

  private groupByJournal(lines: LedgerLineSource[]): Map<string, LedgerLineSource[]> {
    const result = new Map<string, LedgerLineSource[]>();
    for (const line of lines) {
      const existing = result.get(line.journalId) ?? [];
      existing.push(line);
      result.set(line.journalId, existing);
    }
    return result;
  }

  private primaryCounterparty(lines: LedgerLineSource[], accountsById: Map<string, ReportAccount>): ReportAccount | null {
    const candidates = lines
      .map((line) => ({ line, account: accountsById.get(line.accountId) ?? null }))
      .filter((item): item is { line: LedgerLineSource; account: ReportAccount } => item.account !== null)
      .sort((a, b) => Number(b.line.amount - a.line.amount) || a.account.code.localeCompare(b.account.code));
    return candidates[0]?.account ?? null;
  }

  private cashFlowSection(activity: CashFlowActivity, activityLines: Map<string, CashFlowLine>): CashFlowSection {
    const lines = [...activityLines.values()]
      .filter((line) => line.activity === activity && line.amount !== 0n)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return { activity, lines, total: lines.reduce((sum, line) => sum + line.amount, 0n) };
  }

  private inventoryMovementTotals(): Record<"STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "TRANSFER" | "DIGITAL_CONSUMPTION", bigint> {
    return { STOCK_IN: 0n, STOCK_OUT: 0n, ADJUSTMENT: 0n, TRANSFER: 0n, DIGITAL_CONSUMPTION: 0n };
  }

  private inRangeForTenant(range: ReportDateRange, businessId: string, date: Date): boolean {
    return businessId === range.businessId && date >= range.startsOn && date <= range.endsOn;
  }

  private cashFlowActivity(account: ReportAccount): CashFlowActivity {
    if (this.isInvestingAccount(account)) return "INVESTING";
    if (this.isFinancingAccount(account)) return "FINANCING";
    return "OPERATING";
  }

  private isCashAccount(account: ReportAccount): boolean {
    return account.groupCode === 1 && (account.subtype === "cash" || account.subtype === "bank");
  }

  private isInvestingAccount(account: ReportAccount): boolean {
    return account.groupCode === 1 && !this.isCashAccount(account) && (account.subtype === "fixed_asset" || account.subtype === "investment" || account.subtype === null || account.subtype === undefined);
  }

  private isFinancingAccount(account: ReportAccount): boolean {
    if (account.groupCode === 3) return true;
    if (account.groupCode !== 2) return false;
    return account.subtype !== "accounts_payable" && account.subtype !== "tax_payable" && account.subtype !== "accrued_expense";
  }

  private projectAccountLedger(account: ReportAccount, openingBalance: bigint, lines: LedgerLineSource[]): GeneralLedgerAccount {
    let runningBalance = openingBalance;
    let periodDebit = 0n;
    let periodCredit = 0n;

    const entries = [...lines].sort(this.sortLedgerLine).map((line) => {
      this.assertTenant(account.businessId, line.businessId);
      const debit = line.side === "DEBIT" ? line.amount : 0n;
      const credit = line.side === "CREDIT" ? line.amount : 0n;
      periodDebit += debit;
      periodCredit += credit;
      runningBalance += this.signedAmount(line.side, line.amount, account.normalBalance);

      const entry: LedgerEntry = {
        journalLineId: line.id,
        journalId: line.journalId,
        journalNumber: line.journalNumber,
        transactionDate: line.transactionDate,
        description: line.description,
        source: line.source,
        debit,
        credit,
        runningBalance
      };
      if (line.sourceId !== undefined && line.sourceId !== null) entry.sourceId = line.sourceId;
      return entry;
    });

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      groupCode: account.groupCode,
      normalBalance: account.normalBalance,
      openingBalance,
      periodDebit,
      periodCredit,
      entries,
      closingBalance: runningBalance
    };
  }

  private trialBalanceRow(account: ReportAccount, net: bigint): TrialBalanceRow {
    const isNormalSide = net > 0n;
    const amount = isNormalSide ? net : -net;
    const debit = (account.normalBalance === "DEBIT" && isNormalSide) || (account.normalBalance === "CREDIT" && !isNormalSide) ? amount : 0n;
    const credit = (account.normalBalance === "CREDIT" && isNormalSide) || (account.normalBalance === "DEBIT" && !isNormalSide) ? amount : 0n;

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      groupCode: account.groupCode,
      debit,
      credit
    };
  }

  private netIncomeForLines(range: ReportDateRange, accounts: ReportAccount[], lines: LedgerLineSource[]): bigint {
    return this.generateIncomeStatement(range, accounts, lines).netIncome;
  }

  private earningsLine(accountId: string, accountCode: string, accountName: string, amount: bigint): StatementLine {
    return { accountId, accountCode, accountName, amount };
  }

  private isIncomeStatementLine(line: LedgerLineSource): boolean {
    return [4, 5, 6, 7].includes(line.accountGroupCode);
  }

  private netByAccount(lines: LedgerLineSource[], accountsById: Map<string, ReportAccount>): Map<string, bigint> {
    const result = new Map<string, bigint>();
    for (const line of lines) {
      const account = accountsById.get(line.accountId);
      if (!account) continue;
      this.assertTenant(account.businessId, line.businessId);
      result.set(account.id, (result.get(account.id) ?? 0n) + this.signedAmount(line.side, line.amount, account.normalBalance));
    }
    return result;
  }

  private signedAmount(side: "DEBIT" | "CREDIT", amount: bigint, normalBalance: NormalBalance): bigint {
    return side === normalBalance ? amount : -amount;
  }

  private sortLedgerLine(a: LedgerLineSource, b: LedgerLineSource): number {
    return a.transactionDate.getTime() - b.transactionDate.getTime() || a.journalNumber.localeCompare(b.journalNumber) || a.lineNo - b.lineNo;
  }

  private assertAccountsBelongToTenant(expectedBusinessId: string, accounts: ReportAccount[]): void {
    for (const account of accounts) {
      this.assertTenant(expectedBusinessId, account.businessId);
    }
  }

  private assertTenant(expectedBusinessId: string, actualBusinessId: string): void {
    if (expectedBusinessId !== actualBusinessId) throw new ReportingError("TENANT_MISMATCH", "Report data contains rows from another business.", { expectedBusinessId, actualBusinessId });
  }
}
