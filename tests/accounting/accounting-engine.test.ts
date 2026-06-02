import { describe, expect, it } from "vitest";
import { AccountingEngine } from "../../src/features/accounting/domain/accounting-engine";
import { AccountSnapshot, FiscalPeriodSnapshot, PostJournalInput } from "../../src/features/accounting/domain/accounting-types";

const period: FiscalPeriodSnapshot = {
  id: "period-2026",
  businessId: "biz-1",
  startsOn: new Date("2026-01-01T00:00:00.000Z"),
  endsOn: new Date("2026-12-31T00:00:00.000Z"),
  isClosed: false
};

const accounts: AccountSnapshot[] = [
  { id: "cash", businessId: "biz-1", code: "101", name: "Kas", groupCode: 1, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "revenue", businessId: "biz-1", code: "401", name: "Pendapatan", groupCode: 4, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "summary", businessId: "biz-1", code: "100", name: "Aset Lancar", groupCode: 1, normalBalance: "DEBIT", isPostingAllowed: false, isActive: true }
];

const baseInput: PostJournalInput = {
  businessId: "biz-1",
  transactionDate: new Date("2026-05-30T00:00:00.000Z"),
  source: "CASH_IN",
  description: "Penjualan tunai",
  lines: [
    { accountId: "cash", side: "DEBIT", amount: 100000n },
    { accountId: "revenue", side: "CREDIT", amount: 100000n }
  ]
};

describe("AccountingEngine", () => {
  it("accepts a balanced double-entry journal", () => {
    const journal = new AccountingEngine().validateJournal(baseInput, accounts, period);

    expect(journal.totalDebit).toBe(100000n);
    expect(journal.totalCredit).toBe(100000n);
    expect(journal.lines).toHaveLength(2);
  });

  it("rejects unbalanced journals", () => {
    expect(() =>
      new AccountingEngine().validateJournal(
        { ...baseInput, lines: [{ accountId: "cash", side: "DEBIT", amount: 100000n }, { accountId: "revenue", side: "CREDIT", amount: 90000n }] },
        accounts,
        period
      )
    ).toThrowError(/debit total must equal credit total/i);
  });

  it("rejects closed fiscal periods", () => {
    expect(() => new AccountingEngine().validateJournal(baseInput, accounts, { ...period, isClosed: true })).toThrowError(/closed fiscal period/i);
  });

  it("rejects posting to summary accounts", () => {
    expect(() =>
      new AccountingEngine().validateJournal(
        { ...baseInput, lines: [{ accountId: "summary", side: "DEBIT", amount: 100000n }, { accountId: "revenue", side: "CREDIT", amount: 100000n }] },
        accounts,
        period
      )
    ).toThrowError(/summary or control account/i);
  });

  it("rejects accounts from another tenant", () => {
    expect(() => new AccountingEngine().validateJournal(baseInput, [{ ...accounts[0]!, businessId: "biz-2" }], period)).toThrowError(/same business/i);
  });

  it("rejects accounts with a normal balance that does not match the account group", () => {
    expect(() =>
      new AccountingEngine().validateJournal(
        baseInput,
        [{ ...accounts[0]!, normalBalance: "CREDIT" }, accounts[1]!],
        period
      )
    ).toThrowError(/normal balance/i);
  });
});
