export type EmployeeRole = "DOCTOR" | "NURSE" | "STAFF" | "OTHER";
export type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";
export type PayrollItemPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface PayrollContext {
  businessId: string;
  actorUserId: string;
}

export interface PayrollEmployee {
  id: string;
  businessId: string;
  name: string;
  role: EmployeeRole;
  isActive: boolean;
}

export interface PayrollItemRecord {
  id?: string;
  employeeId: string;
  employeeName: string;
  employeeRole: EmployeeRole;
  employee?: PayrollEmployee;
  salaryAmount: bigint;
  incentiveAmount: bigint;
  deductionAmount: bigint;
  grossAmount: bigint;
  netAmount: bigint;
  paidAmount: bigint;
  paymentStatus: PayrollItemPaymentStatus;
  notes?: string | null;
}

export interface PayrollRunRecord {
  id: string;
  businessId: string;
  period: Date;
  status: PayrollStatus;
  expenseAccountId: string;
  payableAccountId: string;
  deductionPayableAccountId: string | null;
  totalGrossAmount: bigint;
  totalDeductionAmount: bigint;
  totalNetAmount: bigint;
  accruedJournalId: string | null;
  paymentJournalId: string | null;
  items: PayrollItemRecord[];
}

export interface CreatePayrollRunData extends Omit<PayrollRunRecord, "id" | "status" | "accruedJournalId" | "paymentJournalId" | "items"> {
  items: Array<Omit<PayrollItemRecord, "id" | "paidAmount" | "paymentStatus">>;
}

export interface RecordPayrollItemPaymentData {
  payrollRunId: string;
  employeeId: string;
  amount: bigint;
  paymentAccountId: string;
  paidAt: Date;
  journalId: string;
  actorUserId: string;
}

export interface PayrollDashboard {
  totalAccruedAmount: bigint;
  totalPaidAmount: bigint;
  totalOutstandingAmount: bigint;
  pendingApprovalCount: number;
  currentPeriod: PayrollRunRecord | null;
  employeeBalances: Array<{ employeeId: string; employeeName: string; employeeRole: EmployeeRole; outstandingAmount: bigint }>;
}

export interface PayrollOverview {
  employees: PayrollEmployee[];
  runs: PayrollRunRecord[];
  dashboard: PayrollDashboard;
}

export interface PayrollRepository {
  listEmployees(ctx: PayrollContext): Promise<PayrollEmployee[]>;
  findEmployees(ctx: PayrollContext, employeeIds: string[]): Promise<PayrollEmployee[]>;
  createEmployee(ctx: PayrollContext, input: Omit<PayrollEmployee, "id" | "businessId">): Promise<PayrollEmployee>;
  updateEmployee(ctx: PayrollContext, employeeId: string, input: Omit<PayrollEmployee, "id" | "businessId">): Promise<PayrollEmployee>;
  countEmployeePayrollItems(ctx: PayrollContext, employeeId: string): Promise<number>;
  deleteEmployee(ctx: PayrollContext, employeeId: string): Promise<void>;
  listRuns(ctx: PayrollContext): Promise<PayrollRunRecord[]>;
  findRunByPeriod(ctx: PayrollContext, period: Date): Promise<PayrollRunRecord | null>;
  findRunById(ctx: PayrollContext, payrollRunId: string): Promise<PayrollRunRecord | null>;
  createRun(ctx: PayrollContext, input: CreatePayrollRunData): Promise<PayrollRunRecord>;
  replaceDraftRun(ctx: PayrollContext, payrollRunId: string, input: CreatePayrollRunData): Promise<PayrollRunRecord>;
  deleteRun(ctx: PayrollContext, payrollRunId: string): Promise<void>;
  updateRun(ctx: PayrollContext, payrollRunId: string, input: Partial<Pick<PayrollRunRecord, "status" | "accruedJournalId" | "paymentJournalId">> & { approvedAt?: Date; paidAt?: Date }): Promise<PayrollRunRecord>;
  recordItemPayment(ctx: PayrollContext, input: RecordPayrollItemPaymentData): Promise<PayrollRunRecord>;
}
