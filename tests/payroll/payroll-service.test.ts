import { describe, expect, it } from "vitest";
import { PayrollService } from "../../src/features/payroll/application/payroll-service";

const ctx = { businessId: "clinic-1", actorUserId: "owner-1" };

class InMemoryPayrollRepository {
  employees = [
    { id: "doctor-1", businessId: "clinic-1", name: "dr. Rina", role: "DOCTOR", isActive: true },
    { id: "nurse-1", businessId: "clinic-1", name: "Siti", role: "NURSE", isActive: true },
  ];
  run: any = null;

  async findEmployees(_ctx: unknown, ids: string[]) { return this.employees.filter((employee) => ids.includes(employee.id)); }
  async findRunByPeriod() { return this.run; }
  async createRun(_ctx: unknown, input: any) { this.run = { id: "run-1", status: "DRAFT", accruedJournalId: null, paymentJournalId: null, ...input, items: input.items.map((item: any) => ({ ...item, paidAmount: 0n, paymentStatus: "UNPAID" })) }; return this.run; }
  async findRunById() { return this.run; }
  async updateRun(_ctx: unknown, _runId: string, input: any) { this.run = { ...this.run, ...input }; return this.run; }
  async recordItemPayment(_ctx: unknown, input: any) {
    const item = this.run.items.find((candidate: any) => candidate.employeeId === input.employeeId);
    item.paidAmount += input.amount;
    item.paymentStatus = item.paidAmount >= item.netAmount ? "PAID" : "PARTIAL";
    if (this.run.items.every((candidate: any) => candidate.paymentStatus === "PAID")) this.run.status = "PAID";
    return this.run;
  }
  async listEmployees() { return this.employees; }
  async createEmployee(_ctx: unknown, input: any) { const employee = { id: "employee-3", isActive: true, ...input }; this.employees.push(employee); return employee; }
  async updateEmployee(_ctx: unknown, employeeId: string, input: any) { const employee = this.employees.find((candidate) => candidate.id === employeeId); if (!employee) throw new Error("Karyawan tidak ditemukan."); Object.assign(employee, input); return employee; }
  async countEmployeePayrollItems() { return 0; }
  async deleteEmployee(_ctx: unknown, employeeId: string) { this.employees = this.employees.filter((employee) => employee.id !== employeeId); }
  async replaceDraftRun(_ctx: unknown, runId: string, input: any) { this.run = { ...this.run, id: runId, ...input, items: input.items.map((item: any) => ({ ...item, paidAmount: 0n, paymentStatus: "UNPAID" })) }; return this.run; }
  async deleteRun() { this.run = null; }
  async listRuns() { return this.run ? [this.run] : []; }
}

class InMemoryJournal {
  posts: any[] = [];

  async post(command: any) {
    this.posts.push(command);
    return { journalId: `journal-${this.posts.length}`, journalNumber: "JU-0001", postedAt: new Date(), totalDebit: 0n, totalCredit: 0n };
  }
}

describe("PayrollService", () => {
  it("creates a monthly payroll with a different salary for each employee", async () => {
    const repository = new InMemoryPayrollRepository();
    const service = new PayrollService(repository as any, new InMemoryJournal() as any);

    const run = await service.createRun({
      ...ctx,
      period: new Date("2026-08-01"),
      expenseAccountId: "expense-1",
      payableAccountId: "payable-1",
      deductionPayableAccountId: "deduction-1",
      items: [
        { employeeId: "doctor-1", salaryAmount: 12_500_000n, incentiveAmount: 2_750_000n, deductionAmount: 1_250_000n },
        { employeeId: "nurse-1", salaryAmount: 5_000_000n, incentiveAmount: 500_000n, deductionAmount: 0n },
      ],
    });

    expect(run.period.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(run.totalGrossAmount).toBe(20_750_000n);
    expect(run.totalNetAmount).toBe(19_500_000n);
    expect(run.items[0]!.netAmount).toBe(14_000_000n);
    expect(run.items[1]!.netAmount).toBe(5_500_000n);
  });

  it("posts expense, wage payable, and deduction payable when a payroll is approved", async () => {
    const repository = new InMemoryPayrollRepository();
    const journal = new InMemoryJournal();
    const service = new PayrollService(repository as any, journal as any);
    await service.createRun({
      ...ctx,
      period: new Date("2026-08-01"),
      expenseAccountId: "expense-1",
      payableAccountId: "payable-1",
      deductionPayableAccountId: "deduction-1",
      items: [{ employeeId: "doctor-1", salaryAmount: 12_500_000n, incentiveAmount: 2_750_000n, deductionAmount: 1_250_000n }],
    });

    const approved = await service.approveRun({ ...ctx, payrollRunId: "run-1", approvedAt: new Date("2026-08-31") });

    expect(approved.status).toBe("APPROVED");
    expect(journal.posts).toHaveLength(1);
    expect(journal.posts[0].lines).toEqual([
      { accountId: "expense-1", side: "DEBIT", amount: 15_250_000n },
      { accountId: "payable-1", side: "CREDIT", amount: 14_000_000n },
      { accountId: "deduction-1", side: "CREDIT", amount: 1_250_000n },
    ]);
  });

  it("pays one nurse while the doctor remains unpaid", async () => {
    const repository = new InMemoryPayrollRepository();
    const journal = new InMemoryJournal();
    const service = new PayrollService(repository as any, journal as any);
    await service.createRun({
      ...ctx,
      period: new Date("2026-08-01"),
      expenseAccountId: "expense-1",
      payableAccountId: "payable-1",
      items: [
        { employeeId: "doctor-1", salaryAmount: 12_500_000n, incentiveAmount: 0n, deductionAmount: 0n },
        { employeeId: "nurse-1", salaryAmount: 5_000_000n, incentiveAmount: 0n, deductionAmount: 0n },
      ],
    });
    await service.approveRun({ ...ctx, payrollRunId: "run-1", approvedAt: new Date("2026-08-31") });

    const paid = await service.payItem({ ...ctx, payrollRunId: "run-1", employeeId: "nurse-1", paymentAccountId: "cash-1", amount: 5_000_000n, paidAt: new Date("2026-09-01") });

    expect(paid.status).toBe("APPROVED");
    expect(paid.items.find((item: any) => item.employeeId === "nurse-1")?.paymentStatus).toBe("PAID");
    expect(paid.items.find((item: any) => item.employeeId === "doctor-1")?.paymentStatus).toBe("UNPAID");
    expect(journal.posts.at(-1)?.lines).toEqual([
      { accountId: "payable-1", side: "DEBIT", amount: 5_000_000n },
      { accountId: "cash-1", side: "CREDIT", amount: 5_000_000n },
    ]);
  });

  it("keeps the balance payable when an employee is paid partially", async () => {
    const repository = new InMemoryPayrollRepository();
    const service = new PayrollService(repository as any, new InMemoryJournal() as any);
    await service.createRun({
      ...ctx,
      period: new Date("2026-08-01"),
      expenseAccountId: "expense-1",
      payableAccountId: "payable-1",
      items: [{ employeeId: "nurse-1", salaryAmount: 5_000_000n, incentiveAmount: 0n, deductionAmount: 0n }],
    });
    await service.approveRun({ ...ctx, payrollRunId: "run-1", approvedAt: new Date("2026-08-31") });

    const partial = await service.payItem({ ...ctx, payrollRunId: "run-1", employeeId: "nurse-1", paymentAccountId: "cash-1", amount: 2_000_000n, paidAt: new Date("2026-09-01") });

    expect(partial.status).toBe("APPROVED");
    expect(partial.items[0]).toMatchObject({ paidAmount: 2_000_000n, paymentStatus: "PARTIAL" });
    await expect(service.payItem({ ...ctx, payrollRunId: "run-1", employeeId: "nurse-1", paymentAccountId: "cash-1", amount: 3_000_001n, paidAt: new Date("2026-09-02") })).rejects.toThrow("melebihi sisa utang");
  });

  it("allows editing a draft but locks it after approval", async () => {
    const repository = new InMemoryPayrollRepository();
    const service = new PayrollService(repository as any, new InMemoryJournal() as any);
    const draft = { ...ctx, payrollRunId: "run-1", period: new Date("2026-08-01"), expenseAccountId: "expense-1", payableAccountId: "payable-1", items: [{ employeeId: "nurse-1", salaryAmount: 5_000_000n, incentiveAmount: 0n, deductionAmount: 0n }] };
    await service.createRun(draft);
    const updated = await service.updateDraftRun({ ...draft, items: [{ employeeId: "nurse-1", salaryAmount: 6_000_000n, incentiveAmount: 0n, deductionAmount: 0n }] });
    expect(updated.totalNetAmount).toBe(6_000_000n);
    await service.approveRun({ ...ctx, payrollRunId: "run-1", approvedAt: new Date("2026-08-31") });
    await expect(service.updateDraftRun(draft)).rejects.toThrow("Hanya payroll draft");
  });
});
