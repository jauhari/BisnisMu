import { describe, expect, it } from "vitest";
import { JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import { AccountSnapshot, FiscalPeriodSnapshot, TenantContext as AccountingTenantContext, ValidatedJournal } from "../../src/features/accounting/domain/accounting-types";
import { CreateFloatTransactionRecord, FloatAuditEvent, FloatRepository } from "../../src/features/float/application/float-repository";
import { FloatManagementService } from "../../src/features/float/application/float-service";
import { CreateFloatAccountInput, FloatAccountEntity, FloatBalanceSnapshotEntity, FloatBalanceSnapshotInput, FloatTransactionEntity, TenantContext } from "../../src/features/float/domain/float-types";

class PostingRepo implements JournalRepository {
  posted: ValidatedJournal[] = [];
  constructor(private readonly accounts: AccountSnapshot[]) {}
  async findAccountsForPosting(ctx: AccountingTenantContext, ids: string[]) { return this.accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async findOpenFiscalPeriod(ctx: AccountingTenantContext): Promise<FiscalPeriodSnapshot | null> { return { id: "period-1", businessId: ctx.businessId, startsOn: new Date("2026-01-01T00:00:00.000Z"), endsOn: new Date("2026-12-31T00:00:00.000Z"), isClosed: false }; }
  async findPostedJournalByIdempotencyKey() { return null; }
  async createPostedJournal(_ctx: AccountingTenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> { this.posted.push(journal); return { journalId: "journal-" + this.posted.length, journalNumber: "JV-" + this.posted.length, postedAt: new Date(), totalDebit: journal.totalDebit, totalCredit: journal.totalCredit }; }
  async createAuditLog() {}
}

class InMemoryFloatRepository implements FloatRepository {
  floats = new Map<string, FloatAccountEntity>();
  transactions = new Map<string, FloatTransactionEntity>();
  snapshots = new Map<string, FloatBalanceSnapshotEntity>();
  auditEvents: FloatAuditEvent[] = [];
  private seq = 1;
  constructor(private readonly accounts: AccountSnapshot[]) {}
  async findAccounts(ctx: TenantContext, ids: string[]) { return this.accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async createFloatAccount(ctx: TenantContext, input: CreateFloatAccountInput) { const fa: FloatAccountEntity = { id: "float-" + this.seq++, businessId: ctx.businessId, provider: input.provider, providerAccountId: input.providerAccountId ?? null, name: input.name.trim(), floatAssetAccountId: input.floatAssetAccountId, offsetAccountId: input.offsetAccountId, currentBalance: input.openingBalance ?? 0n, isActive: true }; this.floats.set(fa.id, fa); return fa; }
  async findFloatAccount(ctx: TenantContext, id: string) { const fa = this.floats.get(id); return fa?.businessId === ctx.businessId ? fa : null; }
  async nextTransactionNumber() { return "FLOAT-202605-" + String(this.seq++).padStart(5, "0"); }
  async createTransaction(ctx: TenantContext, input: CreateFloatTransactionRecord) { const tx: FloatTransactionEntity = { id: "float-tx-" + this.seq++, businessId: ctx.businessId, transactionNumber: input.transactionNumber, type: input.type, floatAccountId: input.floatAccountId, destinationFloatAccountId: input.destinationFloatAccountId ?? null, cashAccountId: input.cashAccountId ?? null, transactionDate: input.transactionDate, amount: input.amount, balanceAfter: input.balanceAfter, description: input.description, postedJournalId: input.postedJournalId, createdByUserId: ctx.actorUserId }; this.transactions.set(tx.id, tx); return tx; }
  async updateFloatBalance(ctx: TenantContext, id: string, balance: bigint) { const fa = (await this.findFloatAccount(ctx, id))!; const updated = { ...fa, currentBalance: balance }; this.floats.set(id, updated); return updated; }
  async createBalanceSnapshot(ctx: TenantContext, input: FloatBalanceSnapshotInput, balance: bigint) { const snapshot: FloatBalanceSnapshotEntity = { id: "snapshot-" + this.seq++, businessId: ctx.businessId, floatAccountId: input.floatAccountId, snapshotDate: input.snapshotDate, balance }; this.snapshots.set(snapshot.id, snapshot); return snapshot; }
  async createAuditLog(_ctx: TenantContext, event: FloatAuditEvent) { this.auditEvents.push(event); }
}

const accounts: AccountSnapshot[] = [
  { id: "cash", businessId: "biz-1", code: "110101", name: "Kas", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "float-asset", businessId: "biz-1", code: "110301", name: "Float PPOB", groupCode: 1, subtype: "float", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "float-asset-2", businessId: "biz-1", code: "110302", name: "Float E-Wallet", groupCode: 1, subtype: "float", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "expense", businessId: "biz-1", code: "610101", name: "Beban PPOB", groupCode: 6, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "adjustment", businessId: "biz-1", code: "710101", name: "Selisih Float", groupCode: 7, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "other-cash", businessId: "biz-2", code: "110101", name: "Tenant Cash", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true }
];

function setup() { const floatRepo = new InMemoryFloatRepository(accounts); const postingRepo = new PostingRepo(accounts); const service = new FloatManagementService(floatRepo, new JournalPostingService(postingRepo)); return { floatRepo, postingRepo, service }; }
const base = { businessId: "biz-1", actorUserId: "user-1", transactionDate: new Date("2026-05-30T00:00:00.000Z") };

async function createFloat(service: FloatManagementService, overrides: Partial<CreateFloatAccountInput> = {}) {
  return service.createFloatAccount({ businessId: "biz-1", actorUserId: "user-1", provider: "FASTPAY", name: "Fastpay Main", floatAssetAccountId: "float-asset", offsetAccountId: "adjustment", ...overrides });
}

describe("FloatManagementService", () => {
  it("posts topup debit float asset and credit cash", async () => {
    const { postingRepo, service } = setup();
    const float = await createFloat(service);
    const result = await service.topupFloat({ ...base, floatAccountId: float.id, cashAccountId: "cash", amount: 250000n, description: "Topup Fastpay" });
    expect(result.transaction.balanceAfter).toBe(250000n);
    expect(postingRepo.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["float-asset", "DEBIT"], ["cash", "CREDIT"]]);
  });

  it("posts consumption crediting float asset", async () => {
    const { postingRepo, service } = setup();
    const float = await createFloat(service, { openingBalance: 100000n });
    const result = await service.consumeFloat({ ...base, floatAccountId: float.id, expenseAccountId: "expense", amount: 40000n, description: "Token PLN" });
    expect(result.transaction.balanceAfter).toBe(60000n);
    expect(postingRepo.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["expense", "DEBIT"], ["float-asset", "CREDIT"]]);
  });

  it("transfers between float accounts", async () => {
    const { floatRepo, postingRepo, service } = setup();
    const source = await createFloat(service, { openingBalance: 150000n });
    const destination = await createFloat(service, { provider: "SHOPEEPAY", name: "ShopeePay", floatAssetAccountId: "float-asset-2" });
    const result = await service.transferFloat({ ...base, floatAccountId: source.id, destinationFloatAccountId: destination.id, amount: 50000n, description: "Move provider balance" });
    expect(result.transaction.balanceAfter).toBe(100000n);
    expect(await service.getBalance({ businessId: "biz-1", actorUserId: "user-1", floatAccountId: destination.id })).toBe(50000n);
    expect(floatRepo.auditEvents.at(-1)?.action).toBe("FLOAT_TRANSFER_POSTED");
    expect(postingRepo.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["float-asset-2", "DEBIT"], ["float-asset", "CREDIT"]]);
  });

  it("prevents negative balances", async () => {
    const { service } = setup();
    const float = await createFloat(service, { openingBalance: 10000n });
    await expect(service.consumeFloat({ ...base, floatAccountId: float.id, expenseAccountId: "expense", amount: 10001n, description: "Too much" })).rejects.toThrow(/negative/i);
  });

  it("isolates tenants for accounts and floats", async () => {
    const { service } = setup();
    await expect(createFloat(service, { floatAssetAccountId: "other-cash" })).rejects.toThrow(/not found/i);
    const float = await createFloat(service);
    await expect(service.getBalance({ businessId: "biz-2", actorUserId: "user-2", floatAccountId: float.id })).rejects.toThrow(/not found/i);
  });
});
