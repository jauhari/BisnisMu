import { Prisma, PrismaClient } from "@prisma/client";
import type { CreatePayrollRunData, PayrollContext, PayrollEmployee, PayrollRepository, PayrollRunRecord, RecordPayrollItemPaymentData } from "../application/payroll-repository";

export class PrismaPayrollRepository implements PayrollRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listEmployees(ctx: PayrollContext): Promise<PayrollEmployee[]> {
    const employees = await this.prisma.employee.findMany({ where: { businessId: ctx.businessId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
    return employees.map((employee) => ({ id: employee.id, businessId: employee.businessId, name: employee.name, role: employee.role, isActive: employee.isActive }));
  }

  async findEmployees(ctx: PayrollContext, employeeIds: string[]): Promise<PayrollEmployee[]> {
    const employees = await this.prisma.employee.findMany({ where: { businessId: ctx.businessId, id: { in: employeeIds } } });
    return employees.map((employee) => ({ id: employee.id, businessId: employee.businessId, name: employee.name, role: employee.role, isActive: employee.isActive }));
  }

  async createEmployee(ctx: PayrollContext, input: Omit<PayrollEmployee, "id" | "businessId">): Promise<PayrollEmployee> {
    const employee = await this.prisma.employee.create({ data: { businessId: ctx.businessId, name: input.name, role: input.role, isActive: input.isActive } });
    return { id: employee.id, businessId: employee.businessId, name: employee.name, role: employee.role, isActive: employee.isActive };
  }

  async updateEmployee(ctx: PayrollContext, employeeId: string, input: Omit<PayrollEmployee, "id" | "businessId">): Promise<PayrollEmployee> {
    const employee = await this.prisma.employee.update({ where: { id: employeeId, businessId: ctx.businessId }, data: input });
    return { id: employee.id, businessId: employee.businessId, name: employee.name, role: employee.role, isActive: employee.isActive };
  }

  async countEmployeePayrollItems(ctx: PayrollContext, employeeId: string): Promise<number> {
    return this.prisma.payrollItem.count({ where: { businessId: ctx.businessId, employeeId } });
  }

  async deleteEmployee(ctx: PayrollContext, employeeId: string): Promise<void> {
    await this.prisma.employee.delete({ where: { id: employeeId, businessId: ctx.businessId } });
  }

  async listRuns(ctx: PayrollContext): Promise<PayrollRunRecord[]> {
    const runs = await this.prisma.payrollRun.findMany({ where: { businessId: ctx.businessId }, include: { items: { orderBy: { employeeName: "asc" } } }, orderBy: { period: "desc" } });
    return runs.map((run) => this.toRun(run));
  }

  async findRunByPeriod(ctx: PayrollContext, period: Date): Promise<PayrollRunRecord | null> {
    const run = await this.prisma.payrollRun.findUnique({ where: { businessId_period: { businessId: ctx.businessId, period } }, include: { items: { orderBy: { employeeName: "asc" } } } });
    return run ? this.toRun(run) : null;
  }

  async findRunById(ctx: PayrollContext, payrollRunId: string): Promise<PayrollRunRecord | null> {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: payrollRunId, businessId: ctx.businessId }, include: { items: { orderBy: { employeeName: "asc" } } } });
    return run ? this.toRun(run) : null;
  }

  async createRun(ctx: PayrollContext, input: CreatePayrollRunData): Promise<PayrollRunRecord> {
    const run = await this.prisma.payrollRun.create({
      data: {
        businessId: ctx.businessId,
        period: input.period,
        expenseAccountId: input.expenseAccountId,
        payableAccountId: input.payableAccountId,
        deductionPayableAccountId: input.deductionPayableAccountId,
        totalGrossAmount: input.totalGrossAmount,
        totalDeductionAmount: input.totalDeductionAmount,
        totalNetAmount: input.totalNetAmount,
        createdByUserId: ctx.actorUserId,
        items: { create: input.items.map((item) => ({ businessId: ctx.businessId, employeeId: item.employeeId, employeeName: item.employeeName, employeeRole: item.employeeRole, salaryAmount: item.salaryAmount, incentiveAmount: item.incentiveAmount, deductionAmount: item.deductionAmount, grossAmount: item.grossAmount, netAmount: item.netAmount, paymentStatus: item.netAmount === 0n ? "PAID" : "UNPAID", notes: item.notes ?? null })) },
      },
      include: { items: { orderBy: { employeeName: "asc" } } },
    });
    return this.toRun(run);
  }

  async replaceDraftRun(ctx: PayrollContext, payrollRunId: string, input: CreatePayrollRunData): Promise<PayrollRunRecord> {
    const run = await this.prisma.$transaction(async (tx) => {
      await tx.payrollItem.deleteMany({ where: { payrollRunId, businessId: ctx.businessId } });
      return tx.payrollRun.update({
        where: { id: payrollRunId, businessId: ctx.businessId },
        data: {
          period: input.period,
          expenseAccountId: input.expenseAccountId,
          payableAccountId: input.payableAccountId,
          deductionPayableAccountId: input.deductionPayableAccountId,
          totalGrossAmount: input.totalGrossAmount,
          totalDeductionAmount: input.totalDeductionAmount,
          totalNetAmount: input.totalNetAmount,
          items: { create: input.items.map((item) => ({ businessId: ctx.businessId, employeeId: item.employeeId, employeeName: item.employeeName, employeeRole: item.employeeRole, salaryAmount: item.salaryAmount, incentiveAmount: item.incentiveAmount, deductionAmount: item.deductionAmount, grossAmount: item.grossAmount, netAmount: item.netAmount, paymentStatus: item.netAmount === 0n ? "PAID" : "UNPAID", notes: item.notes ?? null })) },
        },
        include: { items: { orderBy: { employeeName: "asc" } } },
      });
    });
    return this.toRun(run);
  }

  async deleteRun(ctx: PayrollContext, payrollRunId: string): Promise<void> {
    await this.prisma.payrollRun.delete({ where: { id: payrollRunId, businessId: ctx.businessId } });
  }

  async updateRun(ctx: PayrollContext, payrollRunId: string, input: { status?: "DRAFT" | "APPROVED" | "PAID"; accruedJournalId?: string | null; paymentJournalId?: string | null; approvedAt?: Date; paidAt?: Date }): Promise<PayrollRunRecord> {
    const run = await this.prisma.payrollRun.update({
      where: { id: payrollRunId, businessId: ctx.businessId },
      data: input,
      include: { items: { orderBy: { employeeName: "asc" } } },
    });
    return this.toRun(run);
  }

  async recordItemPayment(ctx: PayrollContext, input: RecordPayrollItemPaymentData): Promise<PayrollRunRecord> {
    const run = await this.prisma.$transaction(async (tx) => {
      const item = await tx.payrollItem.findFirst({ where: { payrollRunId: input.payrollRunId, employeeId: input.employeeId, businessId: ctx.businessId } });
      if (!item) throw new Error("Rincian gaji karyawan tidak ditemukan.");
      const nextPaidAmount = item.paidAmount + input.amount;
      if (nextPaidAmount > item.netAmount) throw new Error("Pembayaran melebihi sisa utang gaji karyawan.");
      const paymentStatus = nextPaidAmount === item.netAmount ? "PAID" : "PARTIAL";

      await tx.payrollItem.update({ where: { id: item.id }, data: { paidAmount: nextPaidAmount, paymentStatus } });
      await tx.payrollPayment.create({ data: { businessId: ctx.businessId, payrollRunId: input.payrollRunId, payrollItemId: item.id, paymentAccountId: input.paymentAccountId, amount: input.amount, paidAt: input.paidAt, journalId: input.journalId, createdByUserId: input.actorUserId } });

      const unpaidCount = await tx.payrollItem.count({ where: { payrollRunId: input.payrollRunId, paymentStatus: { not: "PAID" } } });
      return tx.payrollRun.update({
        where: { id: input.payrollRunId },
        data: unpaidCount === 0 ? { status: "PAID", paidAt: input.paidAt } : { status: "APPROVED" },
        include: { items: { orderBy: { employeeName: "asc" } } },
      });
    });
    return this.toRun(run);
  }

  private toRun(run: Prisma.PayrollRunGetPayload<{ include: { items: true } }>): PayrollRunRecord {
    return {
      id: run.id,
      businessId: run.businessId,
      period: run.period,
      status: run.status,
      expenseAccountId: run.expenseAccountId,
      payableAccountId: run.payableAccountId,
      deductionPayableAccountId: run.deductionPayableAccountId,
      totalGrossAmount: run.totalGrossAmount,
      totalDeductionAmount: run.totalDeductionAmount,
      totalNetAmount: run.totalNetAmount,
      accruedJournalId: run.accruedJournalId,
      paymentJournalId: run.paymentJournalId,
      items: run.items.map((item) => ({ id: item.id, employeeId: item.employeeId, employeeName: item.employeeName, employeeRole: item.employeeRole, salaryAmount: item.salaryAmount, incentiveAmount: item.incentiveAmount, deductionAmount: item.deductionAmount, grossAmount: item.grossAmount, netAmount: item.netAmount, paidAmount: item.paidAmount, paymentStatus: item.paymentStatus, notes: item.notes })),
    };
  }
}
