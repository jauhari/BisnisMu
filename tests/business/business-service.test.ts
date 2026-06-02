import { describe, expect, it } from "vitest";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import { JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { AccountSnapshot, FiscalPeriodSnapshot, TenantContext as AccountingTenantContext, ValidatedJournal } from "../../src/features/accounting/domain/accounting-types";
import { BusinessRepository, BusinessAuditEvent } from "../../src/features/business/application/business-repository";
import { BusinessService } from "../../src/features/business/application/business-service";
import { BeginningBalanceEntry, BeginningBalanceLine, BusinessEntity, CreateBusinessInput, FiscalPeriodEntity, TenantContext, UpdateBusinessSettingsInput } from "../../src/features/business/domain/business-types";

class PostingRepo implements JournalRepository {
  constructor(private readonly accounts: AccountSnapshot[], private readonly periods: FiscalPeriodEntity[]) {}
  posted: ValidatedJournal[] = [];
  async findAccountsForPosting(ctx: AccountingTenantContext, ids: string[]) { return this.accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async findOpenFiscalPeriod(ctx: AccountingTenantContext, date: Date): Promise<FiscalPeriodSnapshot | null> {
    const p = this.periods.find((period) => period.businessId === ctx.businessId && !period.isClosed && date >= period.startsOn && date <= period.endsOn);
    return p ? { id: p.id, businessId: p.businessId, startsOn: p.startsOn, endsOn: p.endsOn, isClosed: p.isClosed } : null;
  }
  async findPostedJournalByIdempotencyKey() { return null; }
  async createPostedJournal(_ctx: AccountingTenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> {
    this.posted.push(journal);
    return { journalId: "journal-" + this.posted.length, journalNumber: "JV-OPENING-00001", postedAt: new Date(), totalDebit: journal.totalDebit, totalCredit: journal.totalCredit };
  }
  async createAuditLog() {}
}

class InMemoryBusinessRepository implements BusinessRepository {
  businesses = new Map<string, BusinessEntity>();
  periods = new Map<string, FiscalPeriodEntity>();
  balances = new Map<string, BeginningBalanceEntry>();
  accounts: AccountSnapshot[] = [];
  auditEvents: BusinessAuditEvent[] = [];
  private seq = 1;

  async createBusiness(actorUserId: string, input: CreateBusinessInput & { name: string; currency: "IDR"; fiscalYearStart: number }): Promise<BusinessEntity> {
    const business: BusinessEntity = { id: "biz-" + this.seq++, name: input.name, type: input.type, status: "ACTIVE", npwpNumber: input.npwpNumber ?? null, address: input.address ?? null, fiscalYearStart: input.fiscalYearStart, currency: "IDR", settings: input.settings ?? {}, createdByUserId: actorUserId };
    this.businesses.set(business.id, business);
    return business;
  }
  async findBusiness(ctx: TenantContext) { return this.businesses.get(ctx.businessId) ?? null; }
  async updateBusinessSettings(ctx: TenantContext, input: UpdateBusinessSettingsInput) {
    const b = this.businesses.get(ctx.businessId)!;
    const updated: BusinessEntity = { ...b, name: input.name ?? b.name, npwpNumber: input.npwpNumber !== undefined ? input.npwpNumber : (b.npwpNumber ?? null), address: input.address !== undefined ? input.address : (b.address ?? null), fiscalYearStart: input.fiscalYearStart ?? b.fiscalYearStart, settings: input.settings !== undefined ? input.settings : (b.settings ?? null) };
    this.businesses.set(ctx.businessId, updated);
    return updated;
  }
  async findFiscalPeriod(ctx: TenantContext, id: string) { const p = this.periods.get(id); return p?.businessId === ctx.businessId ? p : null; }
  async findFiscalPeriodByYear(ctx: TenantContext, year: number) { return [...this.periods.values()].find((p) => p.businessId === ctx.businessId && p.fiscalYear === year) ?? null; }
  async createFiscalPeriod(ctx: TenantContext, input: { name: string; fiscalYear: number; startsOn: Date; endsOn: Date }) {
    const p: FiscalPeriodEntity = { id: "period-" + this.seq++, businessId: ctx.businessId, name: input.name, fiscalYear: input.fiscalYear, startsOn: input.startsOn, endsOn: input.endsOn, status: "OPEN", isClosed: false };
    this.periods.set(p.id, p);
    return p;
  }
  async closeFiscalPeriod(ctx: TenantContext, id: string) { const p = (await this.findFiscalPeriod(ctx, id))!; const updated = { ...p, status: "CLOSED" as const, isClosed: true, closedAt: new Date(), closedByUserId: ctx.actorUserId }; this.periods.set(id, updated); return updated; }
  async reopenFiscalPeriod(ctx: TenantContext, id: string, reason: string) { const p = (await this.findFiscalPeriod(ctx, id))!; const updated = { ...p, status: "OPEN" as const, isClosed: false, reopenedAt: new Date(), reopenedByUserId: ctx.actorUserId, reopenReason: reason }; this.periods.set(id, updated); return updated; }
  async findAccountsForBeginningBalance(ctx: TenantContext, ids: string[]) { return this.accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async saveBeginningBalances(ctx: TenantContext, periodId: string, lines: BeginningBalanceLine[]) {
    return lines.map((line, index) => { const row: BeginningBalanceEntry = { id: "bb-" + index, businessId: ctx.businessId, fiscalPeriodId: periodId, accountId: line.accountId, side: line.side, amount: line.amount, status: "DRAFT" }; this.balances.set(ctx.businessId + ":" + periodId + ":" + line.accountId, row); return row; });
  }
  async listBeginningBalances(ctx: TenantContext, periodId: string) { return [...this.balances.values()].filter((b) => b.businessId === ctx.businessId && b.fiscalPeriodId === periodId); }
  async markBeginningBalancesPosted(ctx: TenantContext, periodId: string, journalId: string) { for (const [k, b] of this.balances) if (b.businessId === ctx.businessId && b.fiscalPeriodId === periodId) this.balances.set(k, { ...b, status: "POSTED", postedJournalId: journalId }); }
  async createAuditLog(_ctx: TenantContext, event: BusinessAuditEvent) { this.auditEvents.push(event); }
}

function setup() {
  const repo = new InMemoryBusinessRepository();
  const accounts: AccountSnapshot[] = [
    { id: "cash", businessId: "biz-1", code: "110101", name: "Kas", groupCode: 1, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
    { id: "capital", businessId: "biz-1", code: "310101", name: "Modal", groupCode: 3, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true }
  ];
  repo.accounts = accounts;
  const postingRepo = new PostingRepo(accounts, [...repo.periods.values()]);
  const service = new BusinessService(repo, new JournalPostingService(postingRepo));
  return { repo, postingRepo, service };
}

describe("BusinessService", () => {
  it("creates a business with fiscal settings and audit log", async () => {
    const { repo, service } = setup();
    const business = await service.createBusiness({ actorUserId: "user-1", name: "Warung Sari", type: "UMKM", fiscalYearStart: 1 });
    expect(business.currency).toBe("IDR");
    expect(repo.auditEvents.at(-1)?.action).toBe("BUSINESS_CREATED");
  });

  it("opens fiscal period using non-January fiscal year settings", async () => {
    const { repo, service } = setup();
    repo.businesses.set("biz-1", { id: "biz-1", name: "BUMDes", type: "BUMDES", status: "ACTIVE", fiscalYearStart: 4, currency: "IDR", createdByUserId: "user-1" });
    const period = await service.openFiscalPeriod({ businessId: "biz-1", actorUserId: "user-1", fiscalYear: 2026 });
    expect(period.startsOn.toISOString().slice(0, 10)).toBe("2025-04-01");
    expect(period.endsOn.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("closes and reopens a fiscal period with audit reason", async () => {
    const { repo, service } = setup();
    repo.businesses.set("biz-1", { id: "biz-1", name: "UMKM", type: "UMKM", status: "ACTIVE", fiscalYearStart: 1, currency: "IDR", createdByUserId: "user-1" });
    const period = await service.openFiscalPeriod({ businessId: "biz-1", actorUserId: "user-1", fiscalYear: 2026 });
    await service.closeFiscalPeriod({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: period.id });
    const reopened = await service.reopenFiscalPeriod({ businessId: "biz-1", actorUserId: "user-2", fiscalPeriodId: period.id, reason: "Koreksi saldo awal berdasarkan dokumen audit" });
    expect(reopened.isClosed).toBe(false);
    expect(reopened.reopenReason).toContain("Koreksi saldo awal");
    expect(repo.auditEvents.at(-1)?.action).toBe("FISCAL_PERIOD_REOPENED");
  });

  it("rejects unbalanced beginning balances", async () => {
    const { repo, service } = setup();
    repo.businesses.set("biz-1", { id: "biz-1", name: "UMKM", type: "UMKM", status: "ACTIVE", fiscalYearStart: 1, currency: "IDR", createdByUserId: "user-1" });
    const period = await service.openFiscalPeriod({ businessId: "biz-1", actorUserId: "user-1", fiscalYear: 2026 });
    await expect(service.saveBeginningBalances({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: period.id, lines: [{ accountId: "cash", side: "DEBIT", amount: 100n }, { accountId: "capital", side: "CREDIT", amount: 90n }] })).rejects.toThrow(/balanced/i);
  });

  it("posts balanced beginning balances through journal posting", async () => {
    const { repo, postingRepo, service } = setup();
    repo.businesses.set("biz-1", { id: "biz-1", name: "UMKM", type: "UMKM", status: "ACTIVE", fiscalYearStart: 1, currency: "IDR", createdByUserId: "user-1" });
    const period = await service.openFiscalPeriod({ businessId: "biz-1", actorUserId: "user-1", fiscalYear: 2026 });
    postingRepo["periods"].push(period);
    await service.saveBeginningBalances({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: period.id, lines: [{ accountId: "cash", side: "DEBIT", amount: 100n }, { accountId: "capital", side: "CREDIT", amount: 100n }] });
    const result = await service.postBeginningBalances({ businessId: "biz-1", actorUserId: "user-1", fiscalPeriodId: period.id });
    expect(result.totalDebit).toBe(100n);
    expect(postingRepo.posted).toHaveLength(1);
    expect((await repo.listBeginningBalances({ businessId: "biz-1", actorUserId: "user-1" }, period.id))[0]?.status).toBe("POSTED");
  });
});

