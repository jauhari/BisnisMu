import type { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { PayrollEngine, type PayrollAmounts } from "../domain/payroll-engine";
import type { CreatePayrollRunData, EmployeeRole, PayrollContext, PayrollDashboard, PayrollEmployee, PayrollRepository, PayrollRunRecord } from "./payroll-repository";

export interface CreateEmployeeCommand extends PayrollContext {
  name: string;
  role: EmployeeRole;
}

export interface CreatePayrollRunCommand extends PayrollContext {
  period: Date;
  expenseAccountId: string;
  payableAccountId: string;
  deductionPayableAccountId?: string | undefined;
  items: Array<PayrollAmounts & { employeeId: string; notes?: string }>;
}

export interface UpdateEmployeeCommand extends PayrollContext {
  employeeId: string;
  name: string;
  role: EmployeeRole;
  isActive: boolean;
}

export class PayrollService {
  constructor(
    private readonly repository: PayrollRepository,
    private readonly journal: JournalPostingService,
    private readonly engine = new PayrollEngine(),
  ) {}

  async listEmployees(ctx: PayrollContext): Promise<PayrollEmployee[]> {
    return this.repository.listEmployees(ctx);
  }

  async createEmployee(command: CreateEmployeeCommand): Promise<PayrollEmployee> {
    const name = command.name.trim();
    if (!name) throw new Error("Nama karyawan wajib diisi.");
    return this.repository.createEmployee(command, { name, role: command.role, isActive: true });
  }

  async updateEmployee(command: UpdateEmployeeCommand): Promise<PayrollEmployee> {
    const name = command.name.trim();
    if (!name) throw new Error("Nama karyawan wajib diisi.");
    const employee = await this.repository.findEmployees(command, [command.employeeId]);
    if (employee.length !== 1) throw new Error("Karyawan tidak ditemukan.");
    return this.repository.updateEmployee(command, command.employeeId, { name, role: command.role, isActive: command.isActive });
  }

  async deleteEmployee(command: PayrollContext & { employeeId: string }): Promise<void> {
    const employee = await this.repository.findEmployees(command, [command.employeeId]);
    if (employee.length !== 1) throw new Error("Karyawan tidak ditemukan.");
    if (await this.repository.countEmployeePayrollItems(command, command.employeeId)) {
      throw new Error("Karyawan yang sudah memiliki riwayat payroll tidak dapat dihapus. Nonaktifkan karyawan ini.");
    }
    await this.repository.deleteEmployee(command, command.employeeId);
  }

  async listRuns(ctx: PayrollContext): Promise<PayrollRunRecord[]> {
    return this.repository.listRuns(ctx);
  }

  async getDashboard(ctx: PayrollContext): Promise<PayrollDashboard> {
    const runs = await this.repository.listRuns(ctx);
    const current = this.normalizePeriod(new Date());
    const currentPeriod = runs.find((run) => run.period.getTime() === current.getTime()) ?? null;
    const approvedRuns = runs.filter((run) => run.status !== "DRAFT");
    const totalAccruedAmount = approvedRuns.reduce((sum, run) => sum + run.totalNetAmount, 0n);
    const totalPaidAmount = approvedRuns.reduce((sum, run) => sum + run.items.reduce((itemTotal, item) => itemTotal + item.paidAmount, 0n), 0n);
    const balances = new Map<string, { employeeId: string; employeeName: string; employeeRole: EmployeeRole; outstandingAmount: bigint }>();
    for (const run of approvedRuns) for (const item of run.items) {
      const outstandingAmount = item.netAmount - item.paidAmount;
      if (outstandingAmount <= 0n) continue;
      const currentBalance = balances.get(item.employeeId);
      balances.set(item.employeeId, { employeeId: item.employeeId, employeeName: item.employeeName, employeeRole: item.employeeRole, outstandingAmount: (currentBalance?.outstandingAmount ?? 0n) + outstandingAmount });
    }
    return {
      totalAccruedAmount,
      totalPaidAmount,
      totalOutstandingAmount: totalAccruedAmount - totalPaidAmount,
      pendingApprovalCount: runs.filter((run) => run.status === "DRAFT").length,
      currentPeriod,
      employeeBalances: [...balances.values()].sort((a, b) => (a.outstandingAmount > b.outstandingAmount ? -1 : a.outstandingAmount < b.outstandingAmount ? 1 : a.employeeName.localeCompare(b.employeeName))),
    };
  }

  async createRun(command: CreatePayrollRunCommand): Promise<PayrollRunRecord> {
    const period = this.normalizePeriod(command.period);
    const existing = await this.repository.findRunByPeriod(command, period);
    if (existing) throw new Error("Payroll untuk bulan ini sudah dibuat.");
    const data = await this.buildRunData(command, period);
    return this.repository.createRun(command, data);
  }

  async updateDraftRun(command: CreatePayrollRunCommand & { payrollRunId: string }): Promise<PayrollRunRecord> {
    const run = await this.requireRun(command, command.payrollRunId);
    if (run.status !== "DRAFT") throw new Error("Hanya payroll draft yang dapat diubah.");
    const period = this.normalizePeriod(command.period);
    const existing = await this.repository.findRunByPeriod(command, period);
    if (existing && existing.id !== run.id) throw new Error("Payroll untuk bulan ini sudah dibuat.");
    const data = await this.buildRunData(command, period);
    return this.repository.replaceDraftRun(command, run.id, data);
  }

  async deleteDraftRun(command: PayrollContext & { payrollRunId: string }): Promise<void> {
    const run = await this.requireRun(command, command.payrollRunId);
    if (run.status !== "DRAFT") throw new Error("Hanya payroll draft yang dapat dihapus.");
    await this.repository.deleteRun(command, run.id);
  }

  private async buildRunData(command: CreatePayrollRunCommand, period: Date): Promise<CreatePayrollRunData> {
    if (!command.items.length) throw new Error("Payroll harus memiliki minimal satu karyawan.");
    const employeeIds = command.items.map((item) => item.employeeId);
    if (new Set(employeeIds).size !== employeeIds.length) throw new Error("Karyawan tidak boleh muncul lebih dari sekali dalam payroll.");
    const employees = await this.repository.findEmployees(command, employeeIds);
    if (employees.length !== employeeIds.length || employees.some((employee) => !employee.isActive)) throw new Error("Semua karyawan payroll harus aktif dan berada di bisnis ini.");
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
    const items = command.items.map((item) => {
      const employee = employeesById.get(item.employeeId)!;
      return {
        employeeId: item.employeeId,
        employeeName: employee.name,
        employeeRole: employee.role,
        notes: item.notes ?? null,
        ...this.engine.calculateItem(item),
      };
    });
    const totals = this.engine.summarize(command.items);
    const totalDeductionAmount = items.reduce((total, item) => total + item.deductionAmount, 0n);
    if (totalDeductionAmount > 0n && !command.deductionPayableAccountId) {
      throw new Error("Akun utang potongan wajib dipilih bila ada potongan gaji.");
    }

    return {
      businessId: command.businessId,
      period,
      expenseAccountId: command.expenseAccountId,
      payableAccountId: command.payableAccountId,
      deductionPayableAccountId: command.deductionPayableAccountId ?? null,
      totalGrossAmount: totals.grossAmount,
      totalDeductionAmount,
      totalNetAmount: totals.netAmount,
      items,
    };
  }

  async approveRun(command: PayrollContext & { payrollRunId: string; approvedAt: Date }): Promise<PayrollRunRecord> {
    const run = await this.requireRun(command, command.payrollRunId);
    if (run.status !== "DRAFT") throw new Error("Hanya payroll draft yang dapat disetujui.");
    if (run.totalGrossAmount <= 0n) throw new Error("Isi minimal satu nominal gaji sebelum menyetujui payroll.");

    const lines = [
      { accountId: run.expenseAccountId, side: "DEBIT" as const, amount: run.totalGrossAmount },
      { accountId: run.payableAccountId, side: "CREDIT" as const, amount: run.totalNetAmount },
    ];
    if (run.totalDeductionAmount > 0n) {
      if (!run.deductionPayableAccountId) throw new Error("Akun utang potongan belum diatur.");
      lines.push({ accountId: run.deductionPayableAccountId, side: "CREDIT" as const, amount: run.totalDeductionAmount });
    }

    const posted = await this.journal.post({
      ...command,
      transactionDate: command.approvedAt,
      source: "PAYROLL_ACCRUAL",
      sourceId: run.id,
      description: `Akrual gaji ${this.periodLabel(run.period)}`,
      idempotencyKey: `payroll-accrual:${command.businessId}:${run.id}`,
      lines,
    });
    return this.repository.updateRun(command, run.id, { status: "APPROVED", accruedJournalId: posted.journalId, approvedAt: command.approvedAt });
  }

  async payItem(command: PayrollContext & { payrollRunId: string; employeeId: string; paymentAccountId: string; amount: bigint; paidAt: Date }): Promise<PayrollRunRecord> {
    const run = await this.requireRun(command, command.payrollRunId);
    if (run.status !== "APPROVED") throw new Error("Payroll harus disetujui sebelum dibayar.");
    const item = run.items.find((candidate) => candidate.employeeId === command.employeeId);
    if (!item) throw new Error("Rincian gaji karyawan tidak ditemukan.");
    if (command.amount <= 0n) throw new Error("Nominal pembayaran harus lebih dari nol.");
    const remaining = item.netAmount - item.paidAmount;
    if (command.amount > remaining) throw new Error("Pembayaran melebihi sisa utang gaji karyawan.");

    const posted = await this.journal.post({
      ...command,
      transactionDate: command.paidAt,
      source: "PAYROLL_ITEM_PAYMENT",
      sourceId: `${run.id}:${item.employeeId}:${item.paidAmount.toString()}`,
      description: `Pembayaran gaji ${item.employeeName} ${this.periodLabel(run.period)}`,
      idempotencyKey: `payroll-item-payment:${command.businessId}:${run.id}:${item.employeeId}:${item.paidAmount.toString()}`,
      lines: [
        { accountId: run.payableAccountId, side: "DEBIT", amount: command.amount },
        { accountId: command.paymentAccountId, side: "CREDIT", amount: command.amount },
      ],
    });
    return this.repository.recordItemPayment(command, { payrollRunId: run.id, employeeId: item.employeeId, amount: command.amount, paymentAccountId: command.paymentAccountId, paidAt: command.paidAt, journalId: posted.journalId, actorUserId: command.actorUserId });
  }

  private async requireRun(ctx: PayrollContext, payrollRunId: string): Promise<PayrollRunRecord> {
    const run = await this.repository.findRunById(ctx, payrollRunId);
    if (!run) throw new Error("Payroll tidak ditemukan.");
    return run;
  }

  private normalizePeriod(date: Date): Date {
    if (Number.isNaN(date.getTime())) throw new Error("Periode payroll tidak valid.");
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private periodLabel(date: Date): string {
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  }
}
