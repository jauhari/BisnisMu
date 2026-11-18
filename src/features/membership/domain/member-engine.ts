import {
  FlatScheduleInput,
  MemberError,
  PlannedInstallment,
  SavingsBalances,
} from "./member-types";

const MEMBER_NUMBER_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;
const MAX_TERM_MONTHS = 120;
const MAX_RATE_BPS = 10000;

/**
 * Angka anggota dipakai sebagai kunci alami per bisnis, jadi dibatasi ke
 * karakter aman supaya konsisten saat dipakai di laporan, ekspor, dan URL.
 */
export function assertValidMemberNumber(memberNumber: string): void {
  if (!MEMBER_NUMBER_PATTERN.test(memberNumber)) {
    throw new MemberError(
      "INVALID_MEMBER_NUMBER",
      "Nomor anggota hanya boleh huruf, angka, titik, garis bawah, atau strip (maks 20 karakter).",
      { memberNumber },
    );
  }
}

export function assertPositiveAmount(amount: bigint): void {
  if (amount <= 0n) {
    throw new MemberError("INVALID_AMOUNT", "Jumlah harus lebih besar dari nol.", { amount: amount.toString() });
  }
}

/**
 * Penarikan tidak boleh membuat saldo simpanan minus. Saldo dihitung dari
 * ledger (DEPOSIT - WITHDRAWAL), bukan angka tersimpan yang bisa drift.
 */
export function assertWithdrawalAllowed(balance: bigint, amount: bigint): void {
  assertPositiveAmount(amount);
  if (amount > balance) {
    throw new MemberError(
      "INSUFFICIENT_SAVINGS",
      "Saldo simpanan tidak mencukupi untuk penarikan ini.",
      { balance: balance.toString(), requested: amount.toString() },
    );
  }
}

/**
 * Geser bulan dengan pengaman akhir bulan: 31 Jan + 1 bulan = 28/29 Feb,
 * bukan melompat ke bulan berikutnya.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)));
}

export function assertLoanInput(input: { principal: bigint; termMonths: number; interestRateBps: number }): void {
  if (input.principal <= 0n) {
    throw new MemberError("INVALID_PRINCIPAL", "Pokok pinjaman harus lebih besar dari nol.", {
      principal: input.principal.toString(),
    });
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > MAX_TERM_MONTHS) {
    throw new MemberError("INVALID_TERM", `Tenor harus 1 sampai ${MAX_TERM_MONTHS} bulan.`, {
      termMonths: input.termMonths,
    });
  }
  if (!Number.isInteger(input.interestRateBps) || input.interestRateBps < 0 || input.interestRateBps > MAX_RATE_BPS) {
    throw new MemberError("INVALID_INTEREST_RATE", "Bunga harus 0 sampai 10000 basis poin (0%–100%).", {
      interestRateBps: input.interestRateBps,
    });
  }
}

/**
 * Bunga flat per bulan dalam basis poin dari pokok awal (bukan saldo berjalan).
 * Pembulatan dilakukan per bulan dan sisa pembulatan pokok ditumpuk ke
 * angsuran terakhir supaya total pokok selalu sama persis dengan pinjaman.
 */
export function calculateMonthlyFlatInterest(principal: bigint, interestRateBps: number): bigint {
  if (interestRateBps <= 0) return 0n;
  return (principal * BigInt(interestRateBps)) / 10000n;
}

export function buildFlatSchedule(input: FlatScheduleInput): PlannedInstallment[] {
  assertLoanInput(input);

  const monthlyPrincipal = input.principal / BigInt(input.termMonths);
  const monthlyInterest = calculateMonthlyFlatInterest(input.principal, input.interestRateBps);
  const schedule: PlannedInstallment[] = [];
  let allocated = 0n;

  for (let i = 1; i <= input.termMonths; i += 1) {
    const isLast = i === input.termMonths;
    const principalDue = isLast ? input.principal - allocated : monthlyPrincipal;
    allocated += principalDue;
    schedule.push({
      installmentNo: i,
      dueDate: addMonthsClamped(input.disbursedOn, i),
      principalDue,
      interestDue: monthlyInterest,
    });
  }

  return schedule;
}

export function installmentTotal(installment: { principalDue: bigint; interestDue: bigint }): bigint {
  return installment.principalDue + installment.interestDue;
}

/** v1: pembayaran harus tepat sebesar kewajiban angsuran (tanpa parsial). */
export function assertInstallmentPayment(installment: { principalDue: bigint; interestDue: bigint }, amount: bigint): void {
  assertPositiveAmount(amount);
  const expected = installmentTotal(installment);
  if (amount !== expected) {
    throw new MemberError(
      "INSTALLMENT_AMOUNT_MISMATCH",
      "Jumlah pembayaran harus sama dengan total angsuran (pokok + bunga).",
      { expected: expected.toString(), received: amount.toString() },
    );
  }
}

export function totalSavings(balances: SavingsBalances): bigint {
  return balances.POKOK + balances.WAJIB + balances.SUKARELA;
}

export class MemberEngine {
  readonly assertValidMemberNumber = assertValidMemberNumber;
  readonly assertPositiveAmount = assertPositiveAmount;
  readonly assertWithdrawalAllowed = assertWithdrawalAllowed;
  readonly assertLoanInput = assertLoanInput;
  readonly addMonthsClamped = addMonthsClamped;
  readonly calculateMonthlyFlatInterest = calculateMonthlyFlatInterest;
  readonly buildFlatSchedule = buildFlatSchedule;
  readonly assertInstallmentPayment = assertInstallmentPayment;
  readonly totalSavings = totalSavings;
}
