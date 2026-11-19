import { describe, expect, it } from "vitest";
import {
  MemberEngine,
  addMonthsClamped,
  assertValidMemberNumber,
  assertWithdrawalAllowed,
  buildFlatSchedule,
  calculateMonthlyFlatInterest,
  installmentTotal,
} from "../../src/features/membership/domain/member-engine";
import { MemberError, readMemberLoanSettings } from "../../src/features/membership/domain/member-types";

describe("MemberEngine — validasi anggota", () => {
  it("menerima nomor anggota yang wajar", () => {
    expect(() => assertValidMemberNumber("1001")).not.toThrow();
    expect(() => assertValidMemberNumber("AGT-01")).not.toThrow();
  });

  it("menolak nomor anggota berisi spasi atau kosong", () => {
    expect(() => assertValidMemberNumber("")).toThrow(MemberError);
    expect(() => assertValidMemberNumber("1001 A")).toThrow(MemberError);
  });

  it("menolak penarikan melebihi saldo", () => {
    expect(() => assertWithdrawalAllowed(50_000n, 50_000n)).not.toThrow();
    expect(() => assertWithdrawalAllowed(50_000n, 50_001n)).toThrow(MemberError);
  });

  it("menolak jumlah nol atau negatif", () => {
    expect(() => assertWithdrawalAllowed(10n, 0n)).toThrow(MemberError);
  });
});

describe("MemberEngine — jadwal angsuran flat", () => {
  it("menjumlahkan pokok persis sama dengan pinjaman walau tidak habis dibagi", () => {
    const schedule = buildFlatSchedule({
      principal: 1_000_000n,
      interestRateBps: 0,
      termMonths: 3,
      disbursedOn: new Date("2026-01-15T00:00:00Z"),
    });

    expect(schedule).toHaveLength(3);
    const totalPrincipal = schedule.reduce((sum, item) => sum + item.principalDue, 0n);
    expect(totalPrincipal).toBe(1_000_000n);
    // sisa pembulatan ditumpuk ke angsuran terakhir
    expect(schedule[2]?.principalDue).toBe(333_334n);
  });

  it("menghitung bunga flat dari pokok awal, bukan saldo berjalan", () => {
    const monthly = calculateMonthlyFlatInterest(1_000_000n, 100); // 1% per bulan
    expect(monthly).toBe(10_000n);

    const schedule = buildFlatSchedule({
      principal: 1_000_000n,
      interestRateBps: 100,
      termMonths: 4,
      disbursedOn: new Date("2026-02-01T00:00:00Z"),
    });

    expect(schedule.map((item) => item.interestDue)).toEqual([10_000n, 10_000n, 10_000n, 10_000n]);
    const totalInterest = schedule.reduce((sum, item) => sum + item.interestDue, 0n);
    expect(totalInterest).toBe(40_000n);
    expect(installmentTotal(schedule[0]!)).toBe(260_000n);
  });

  it("menggeser jatuh tempo per bulan dengan pengaman akhir bulan", () => {
    expect(addMonthsClamped(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonthsClamped(new Date("2024-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(addMonthsClamped(new Date("2026-01-15T00:00:00Z"), 2).toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("menolak tenor dan bunga di luar batas", () => {
    expect(() => buildFlatSchedule({ principal: 1_000n, interestRateBps: 0, termMonths: 0, disbursedOn: new Date() })).toThrow(
      MemberError,
    );
    expect(() =>
      buildFlatSchedule({ principal: 1_000n, interestRateBps: 20_000, termMonths: 6, disbursedOn: new Date() }),
    ).toThrow(MemberError);
  });
});

describe("MemberEngine — setting pinjaman", () => {
  it("memakai default kalau setting belum diisi", () => {
    expect(readMemberLoanSettings(null)).toEqual({ defaultInterestRateBps: 0, defaultTermMonths: 12 });
    expect(readMemberLoanSettings({})).toEqual({ defaultInterestRateBps: 0, defaultTermMonths: 12 });
  });

  it("membaca setting dari Business.settings.memberLoan", () => {
    expect(readMemberLoanSettings({ memberLoan: { defaultInterestRateBps: 150, defaultTermMonths: 24 } })).toEqual({
      defaultInterestRateBps: 150,
      defaultTermMonths: 24,
    });
  });

  it("mengabaikan nilai tidak valid", () => {
    expect(readMemberLoanSettings({ memberLoan: { defaultInterestRateBps: -5, defaultTermMonths: 0 } })).toEqual({
      defaultInterestRateBps: 0,
      defaultTermMonths: 12,
    });
  });
});

describe("MemberEngine — instance API", () => {
  it("mengekspos fungsi yang sama lewat class untuk DI", () => {
    const engine = new MemberEngine();
    expect(engine.totalSavings({ POKOK: 1n, WAJIB: 2n, SUKARELA: 3n })).toBe(6n);
  });
});
