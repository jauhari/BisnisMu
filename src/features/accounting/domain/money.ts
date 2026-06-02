import { AccountingError } from "./accounting-types";

export function assertPositiveMinorUnit(amount: bigint, fieldName = "amount"): void {
  if (amount <= 0n) {
    throw new AccountingError("INVALID_AMOUNT", fieldName + " must be greater than zero.", {
      amount: amount.toString()
    });
  }
}

export function sumMinorUnits(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}
