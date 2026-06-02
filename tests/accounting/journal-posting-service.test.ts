import { describe, expect, it } from "vitest";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import { JournalAuditEvent, JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { AccountSnapshot, FiscalPeriodSnapshot, TenantContext, ValidatedJournal } from "../../src/features/accounting/domain/accounting-types";

class InMemoryJournalRepository implements JournalRepository {
  auditEvents: JournalAuditEvent[] = [];
  createdJournals: ValidatedJournal[] = [];
  existingByKey = new Map<string, PostedJournalResult>();

  constructor(
    private readonly accounts: AccountSnapshot[],
    private readonly period: FiscalPeriodSnapshot | null
  ) {}

  async findAccountsForPosting(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    return this.accounts.filter((account) => account.businessId === ctx.businessId && accountIds.includes(account.id));
  }

  async findOpenFiscalPeriod(ctx: TenantContext): Promise<FiscalPeriodSnapshot | null> {
    if (!this.period || this.period.businessId !== ctx.businessId || this.period.isClosed) return null;
    return this.period;
  }

  async findPostedJournalByIdempotencyKey(_ctx: TenantContext, idempotencyKey: string): Promise<PostedJournalResult | null> {
    return this.existingByKey.get(idempotencyKey) ?? null;
  }

  async createPostedJournal(_ctx: TenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> {
    this.createdJournals.push(journal);
    const result = {
      journalId: "journal-1",
      journalNumber: "JV-202605-00001",
      postedAt: new Date("2026-05-30T01:00:00.000Z"),
      totalDebit: journal.totalDebit,
      totalCredit: journal.totalCredit
    };
    if (journal.idempotencyKey) this.existingByKey.set(journal.idempotencyKey, result);
    return result;
  }

  async createAuditLog(_ctx: TenantContext, event: JournalAuditEvent): Promise<void> {
    this.auditEvents.push(event);
  }
}

const accounts: AccountSnapshot[] = [
  { id: "cash", businessId: "biz-1", code: "101", name: "Kas", groupCode: 1, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "revenue", businessId: "biz-1", code: "401", name: "Pendapatan", groupCode: 4, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true }
];

const period: FiscalPeriodSnapshot = {
  id: "period-2026",
  businessId: "biz-1",
  startsOn: new Date("2026-01-01T00:00:00.000Z"),
  endsOn: new Date("2026-12-31T00:00:00.000Z"),
  isClosed: false
};

describe("JournalPostingService", () => {
  it("posts a valid journal and writes an audit log", async () => {
    const repo = new InMemoryJournalRepository(accounts, period);
    const result = await new JournalPostingService(repo).post({
      businessId: "biz-1",
      actorUserId: "user-1",
      transactionDate: new Date("2026-05-30T00:00:00.000Z"),
      source: "CASH_IN",
      description: "Penjualan tunai",
      idempotencyKey: "cash-in-1",
      lines: [
        { accountId: "cash", side: "DEBIT", amount: 50000n },
        { accountId: "revenue", side: "CREDIT", amount: 50000n }
      ]
    });

    expect(result.journalNumber).toBe("JV-202605-00001");
    expect(repo.createdJournals).toHaveLength(1);
    expect(repo.auditEvents.at(-1)?.action).toBe("JOURNAL_POSTED");
  });

  it("returns an existing posted journal for the same idempotency key", async () => {
    const repo = new InMemoryJournalRepository(accounts, period);
    repo.existingByKey.set("same-key", { journalId: "existing", journalNumber: "JV-202605-00009", postedAt: new Date(), totalDebit: 1n, totalCredit: 1n });

    const result = await new JournalPostingService(repo).post({
      businessId: "biz-1",
      actorUserId: "user-1",
      transactionDate: new Date("2026-05-30T00:00:00.000Z"),
      source: "CASH_IN",
      description: "Duplicate request",
      idempotencyKey: "same-key",
      lines: [
        { accountId: "cash", side: "DEBIT", amount: 50000n },
        { accountId: "revenue", side: "CREDIT", amount: 50000n }
      ]
    });

    expect(result.journalId).toBe("existing");
    expect(repo.createdJournals).toHaveLength(0);
  });

  it("audits rejected journals", async () => {
    const repo = new InMemoryJournalRepository(accounts, period);

    await expect(new JournalPostingService(repo).post({
      businessId: "biz-1",
      actorUserId: "user-1",
      transactionDate: new Date("2026-05-30T00:00:00.000Z"),
      source: "CASH_IN",
      description: "Invalid",
      lines: [
        { accountId: "cash", side: "DEBIT", amount: 50000n },
        { accountId: "revenue", side: "CREDIT", amount: 40000n }
      ]
    })).rejects.toThrow(/debit total must equal credit total/i);

    expect(repo.auditEvents.at(-1)?.action).toBe("JOURNAL_POST_REJECTED");
    expect(repo.auditEvents.at(-1)?.metadata.errorCode).toBe("UNBALANCED_JOURNAL");
  });
});
