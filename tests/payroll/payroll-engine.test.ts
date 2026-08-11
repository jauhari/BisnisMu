import { describe, expect, it } from "vitest";
import { PayrollEngine } from "../../src/features/payroll/domain/payroll-engine";

describe("PayrollEngine", () => {
  it("calculates a monthly net salary from salary, incentive, and deduction", () => {
    const engine = new PayrollEngine();

    const item = engine.calculateItem({
      salaryAmount: 12_500_000n,
      incentiveAmount: 2_750_000n,
      deductionAmount: 1_250_000n,
    });

    expect(item.grossAmount).toBe(15_250_000n);
    expect(item.netAmount).toBe(14_000_000n);
  });

  it("rejects a payroll item when deductions exceed the monthly gross salary", () => {
    const engine = new PayrollEngine();

    expect(() => engine.calculateItem({
      salaryAmount: 4_000_000n,
      incentiveAmount: 0n,
      deductionAmount: 4_000_001n,
    })).toThrow(/potongan/i);
  });

  it("summarizes a payroll run across doctors and nurses", () => {
    const engine = new PayrollEngine();

    const totals = engine.summarize([
      { salaryAmount: 12_500_000n, incentiveAmount: 2_750_000n, deductionAmount: 1_250_000n },
      { salaryAmount: 5_000_000n, incentiveAmount: 500_000n, deductionAmount: 0n },
    ]);

    expect(totals.employeeCount).toBe(2);
    expect(totals.grossAmount).toBe(20_750_000n);
    expect(totals.netAmount).toBe(19_500_000n);
  });
});
