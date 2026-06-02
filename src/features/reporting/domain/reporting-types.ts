import { AccountGroupCode, NormalBalance } from "../../accounting/domain/accounting-types";
import { FloatAccountEntity, FloatBalanceSnapshotEntity, FloatTransactionEntity, FloatTransactionType } from "../../float/domain/float-types";
import { InventoryBalanceEntity, InventoryMovementEntity, InventoryMovementType, ProductEntity } from "../../inventory/domain/inventory-types";
import { PurchaseOrderEntity, PurchaseReceiptEntity, PurchaseReturnEntity } from "../../purchase/domain/purchase-types";
import { SalesOrderEntity, SalesStatus } from "../../sales/domain/sales-types";

export interface TenantContext {
  businessId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ReportDateRange {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  fiscalPeriodId?: string;
}

export interface ReportAccount {
  id: string;
  businessId: string;
  code: string;
  name: string;
  groupCode: AccountGroupCode;
  normalBalance: NormalBalance;
  subtype?: string | null;
  parentCode?: string | null;
  isActive: boolean;
}

export interface LedgerLineSource {
  id: string;
  businessId: string;
  journalId: string;
  journalNumber: string;
  transactionDate: Date;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountGroupCode: AccountGroupCode;
  accountNormalBalance: NormalBalance;
  description: string;
  source: string;
  sourceId?: string | null;
  side: "DEBIT" | "CREDIT";
  amount: bigint;
  lineNo: number;
}

export interface LedgerEntry {
  journalLineId: string;
  journalId: string;
  journalNumber: string;
  transactionDate: Date;
  description: string;
  source: string;
  sourceId?: string | null;
  debit: bigint;
  credit: bigint;
  runningBalance: bigint;
}

export interface GeneralLedgerAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  groupCode: AccountGroupCode;
  normalBalance: NormalBalance;
  openingBalance: bigint;
  periodDebit: bigint;
  periodCredit: bigint;
  entries: LedgerEntry[];
  closingBalance: bigint;
}

export interface GeneralLedgerReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  accounts: GeneralLedgerAccount[];
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  groupCode: AccountGroupCode;
  debit: bigint;
  credit: bigint;
}

export interface TrialBalanceReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  rows: TrialBalanceRow[];
  totalDebit: bigint;
  totalCredit: bigint;
  isBalanced: boolean;
}

export interface IncomeStatementReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  revenue: StatementSection;
  cogs: StatementSection;
  expenses: StatementSection;
  otherExpenses: StatementSection;
  grossProfit: bigint;
  netIncome: bigint;
}

export type ProfitAndLossReport = IncomeStatementReport;

export interface StatementLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: bigint;
}

export interface StatementSection {
  lines: StatementLine[];
  total: bigint;
}

export interface BalanceSheetReport {
  businessId: string;
  asOf: Date;
  assets: StatementSection;
  liabilities: StatementSection;
  equity: StatementSection;
  retainedEarnings: StatementLine;
  currentPeriodEarnings: StatementLine;
  totalAssets: bigint;
  totalLiabilitiesAndEquity: bigint;
  isBalanced: boolean;
}

export type CashFlowActivity = "OPERATING" | "INVESTING" | "FINANCING";

export interface CashFlowLine {
  activity: CashFlowActivity;
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: bigint;
}

export interface CashFlowSection {
  activity: CashFlowActivity;
  lines: CashFlowLine[];
  total: bigint;
}

export interface CashFlowReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  beginningCashBalance: bigint;
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netCashChange: bigint;
  endingCashBalance: bigint;
}

export interface SalesReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  orderCount: number;
  itemCount: bigint;
  subtotal: bigint;
  discountTotal: bigint;
  taxTotal: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  outstandingAmount: bigint;
  byStatus: Record<SalesStatus, { count: number; totalAmount: bigint; paidAmount: bigint }>;
}

export type SalesReportInput = SalesOrderEntity[];

export interface PurchaseReportInput {
  orders: PurchaseOrderEntity[];
  receipts?: PurchaseReceiptEntity[];
  returns?: PurchaseReturnEntity[];
}

export interface PurchaseReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  orderCount: number;
  receiptCount: number;
  returnCount: number;
  orderedAmount: bigint;
  receivedCost: bigint;
  returnedCost: bigint;
  netReceivedCost: bigint;
}

export interface InventoryReportInput {
  products?: ProductEntity[];
  balances?: InventoryBalanceEntity[];
  movements?: InventoryMovementEntity[];
}

export interface InventoryReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  productCount: number;
  balanceQuantity: bigint;
  inventoryValue: bigint;
  movementQuantityByType: Record<InventoryMovementType, bigint>;
  movementCostByType: Record<InventoryMovementType, bigint>;
}

export interface FloatReportInput {
  accounts?: FloatAccountEntity[];
  transactions?: FloatTransactionEntity[];
  snapshots?: FloatBalanceSnapshotEntity[];
}

export interface FloatReport {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  accountCount: number;
  currentBalance: bigint;
  transactionAmountByType: Record<FloatTransactionType, bigint>;
  snapshotCount: number;
  latestSnapshotBalance: bigint;
}

export class ReportingError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ReportingError";
  }
}
