export interface PayrollAmounts {
  salaryAmount: bigint;
  incentiveAmount: bigint;
  deductionAmount: bigint;
}

export interface CalculatedPayrollItem extends PayrollAmounts {
  grossAmount: bigint;
  netAmount: bigint;
}

export interface PayrollTotals {
  employeeCount: number;
  grossAmount: bigint;
  netAmount: bigint;
}

export class PayrollEngine {
  calculateItem(amounts: PayrollAmounts): CalculatedPayrollItem {
    if (amounts.salaryAmount < 0n || amounts.incentiveAmount < 0n || amounts.deductionAmount < 0n) {
      throw new Error("Nominal payroll tidak boleh negatif.");
    }

    const grossAmount = amounts.salaryAmount + amounts.incentiveAmount;
    if (grossAmount <= 0n) throw new Error("Gaji atau insentif harus lebih dari nol.");
    if (amounts.deductionAmount > grossAmount) throw new Error("Potongan tidak boleh melebihi gaji bruto.");

    return { ...amounts, grossAmount, netAmount: grossAmount - amounts.deductionAmount };
  }

  summarize(items: PayrollAmounts[]): PayrollTotals {
    const calculated = items.map((item) => this.calculateItem(item));
    return {
      employeeCount: calculated.length,
      grossAmount: calculated.reduce((total, item) => total + item.grossAmount, 0n),
      netAmount: calculated.reduce((total, item) => total + item.netAmount, 0n),
    };
  }
}
