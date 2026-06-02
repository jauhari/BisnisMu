import { describe, expect, it } from "vitest";
import { JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import { AccountSnapshot, FiscalPeriodSnapshot, TenantContext as AccountingTenantContext, ValidatedJournal } from "../../src/features/accounting/domain/accounting-types";
import { CashAuditEvent, CashRepository } from "../../src/features/cash-management/application/cash-repository";
import { CashManagementService } from "../../src/features/cash-management/application/cash-service";
import { CashTransactionDraftInput, CashTransactionEntity, ContactEntity, CreateContactInput, TenantContext } from "../../src/features/cash-management/domain/cash-types";

class PostingRepo implements JournalRepository {
  posted: ValidatedJournal[] = [];
  constructor(private readonly accounts: AccountSnapshot[]) {}
  async findAccountsForPosting(ctx: AccountingTenantContext, ids: string[]) { return this.accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async findOpenFiscalPeriod(ctx: AccountingTenantContext): Promise<FiscalPeriodSnapshot | null> { return { id: "period-1", businessId: ctx.businessId, startsOn: new Date("2026-01-01T00:00:00.000Z"), endsOn: new Date("2026-12-31T00:00:00.000Z"), isClosed: false }; }
  async findPostedJournalByIdempotencyKey() { return null; }
  async createPostedJournal(_ctx: AccountingTenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> { this.posted.push(journal); return { journalId: "journal-" + this.posted.length, journalNumber: "JV-" + this.posted.length, postedAt: new Date(), totalDebit: journal.totalDebit, totalCredit: journal.totalCredit }; }
  async createAuditLog() {}
}

class InMemoryCashRepository implements CashRepository {
  transactions = new Map<string, CashTransactionEntity>();
  contacts = new Map<string, ContactEntity>();
  auditEvents: CashAuditEvent[] = [];
  private seq = 1;
  constructor(private readonly accounts: AccountSnapshot[]) {}
  async findAccounts(ctx: TenantContext, ids: string[]) { return this.accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id)); }
  async findContact(ctx: TenantContext, id: string) { const c = this.contacts.get(id); return c?.businessId === ctx.businessId ? c : null; }
  async createContact(ctx: TenantContext, input: CreateContactInput) { const c: ContactEntity = { id: "contact-" + this.seq++, businessId: ctx.businessId, name: input.name.trim(), type: input.type ?? "OTHER", email: input.email ?? null, phone: input.phone ?? null, address: input.address ?? null, isActive: true }; this.contacts.set(c.id, c); return c; }
  async nextTransactionNumber() { return "CASH-202605-" + String(this.seq++).padStart(5, "0"); }
  async createDraft(ctx: TenantContext, input: CashTransactionDraftInput, number: string) { const tx = this.tx(ctx, input, number); this.transactions.set(tx.id, tx); return tx; }
  async updateDraft(ctx: TenantContext, id: string, input: CashTransactionDraftInput) { const old = (await this.findTransaction(ctx, id))!; const tx = { ...this.tx(ctx, input, old.transactionNumber), id: old.id }; this.transactions.set(id, tx); return tx; }
  async findTransaction(ctx: TenantContext, id: string) { const tx = this.transactions.get(id); return tx?.businessId === ctx.businessId ? tx : null; }
  async markPosted(ctx: TenantContext, id: string, journalId: string) { const tx = (await this.findTransaction(ctx, id))!; const posted = { ...tx, status: "POSTED" as const, postedJournalId: journalId }; this.transactions.set(id, posted); return posted; }
  async markVoided(ctx: TenantContext, id: string, journalId: string, reason: string) { const tx = (await this.findTransaction(ctx, id))!; const voided = { ...tx, status: "VOID" as const, voidJournalId: journalId, voidReason: reason }; this.transactions.set(id, voided); return voided; }
  async createAuditLog(_ctx: TenantContext, event: CashAuditEvent) { this.auditEvents.push(event); }
  private tx(ctx: TenantContext, input: CashTransactionDraftInput, number: string): CashTransactionEntity { return { id: "cash-" + this.seq++, businessId: ctx.businessId, transactionNumber: number, type: input.type, status: "DRAFT", transactionDate: input.transactionDate, cashAccountId: input.cashAccountId, destinationAccountId: input.destinationAccountId ?? null, categoryAccountId: input.categoryAccountId ?? null, contactId: input.contactId ?? null, amount: input.amount, description: input.description, paymentMethod: input.paymentMethod ?? null, referenceNumber: input.referenceNumber ?? null, attachmentKey: input.attachmentKey ?? null, tags: input.tags ?? [], createdByUserId: ctx.actorUserId }; }
}

const accounts: AccountSnapshot[] = [
  { id: "cash", businessId: "biz-1", code: "110101", name: "Kas", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "bank", businessId: "biz-1", code: "110102", name: "Bank", groupCode: 1, subtype: "bank", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "revenue", businessId: "biz-1", code: "410101", name: "Penjualan", groupCode: 4, normalBalance: "CREDIT", isPostingAllowed: true, isActive: true },
  { id: "expense", businessId: "biz-1", code: "610201", name: "Beban Sewa", groupCode: 6, normalBalance: "DEBIT", isPostingAllowed: true, isActive: true },
  { id: "other-cash", businessId: "biz-2", code: "110101", name: "Tenant Cash", groupCode: 1, subtype: "cash", normalBalance: "DEBIT", isPostingAllowed: true, isActive: true }
];

function setup() { const cashRepo = new InMemoryCashRepository(accounts); const postingRepo = new PostingRepo(accounts); return { cashRepo, postingRepo, service: new CashManagementService(cashRepo, new JournalPostingService(postingRepo)) }; }
const base = { businessId: "biz-1", actorUserId: "user-1", transactionDate: new Date("2026-05-30T00:00:00.000Z") };

describe("CashManagementService", () => {
  it("creates contacts with audit trail", async () => {
    const { cashRepo, service } = setup();
    const contact = await service.createContact({ businessId: "biz-1", actorUserId: "user-1", name: "Ibu Sari", type: "CUSTOMER" });
    expect(contact.type).toBe("CUSTOMER");
    expect(cashRepo.auditEvents.at(-1)?.action).toBe("CONTACT_CREATED");
  });

  it("previews cash in journal automatically", async () => {
    const { service } = setup();
    const preview = await service.preview({ ...base, type: "CASH_IN", cashAccountId: "cash", categoryAccountId: "revenue", amount: 100000n, description: "Penjualan tunai" });
    expect(preview.lines.map((l) => [l.accountId, l.side])).toEqual([["cash", "DEBIT"], ["revenue", "CREDIT"]]);
    expect(preview.totalDebit).toBe(100000n);
  });

  it("posts cash out through journal posting", async () => {
    const { postingRepo, service } = setup();
    const draft = await service.createDraft({ ...base, type: "CASH_OUT", cashAccountId: "cash", categoryAccountId: "expense", amount: 50000n, description: "Bayar sewa" });
    const result = await service.post({ businessId: "biz-1", actorUserId: "user-1", transactionId: draft.id });
    expect(result.transaction.status).toBe("POSTED");
    expect(postingRepo.posted[0]?.lines.map((l) => [l.accountId, l.side])).toEqual([["expense", "DEBIT"], ["cash", "CREDIT"]]);
  });

  it("posts transfer between cash and bank", async () => {
    const { service } = setup();
    const preview = await service.preview({ ...base, type: "TRANSFER", cashAccountId: "cash", destinationAccountId: "bank", amount: 75000n, description: "Setor kas ke bank" });
    expect(preview.lines.map((l) => [l.accountId, l.side])).toEqual([["bank", "DEBIT"], ["cash", "CREDIT"]]);
  });

  it("voids posted transaction with reversing journal", async () => {
    const { postingRepo, service } = setup();
    const draft = await service.createDraft({ ...base, type: "CASH_IN", cashAccountId: "cash", categoryAccountId: "revenue", amount: 90000n, description: "Penjualan" });
    await service.post({ businessId: "biz-1", actorUserId: "user-1", transactionId: draft.id });
    const voided = await service.void({ businessId: "biz-1", actorUserId: "user-1", transactionId: draft.id, reason: "Salah input nota" });
    expect(voided.transaction.status).toBe("VOID");
    expect(postingRepo.posted[1]?.lines.map((l) => [l.accountId, l.side])).toEqual([["cash", "CREDIT"], ["revenue", "DEBIT"]]);
  });

  it("rejects accounts from another tenant", async () => {
    const { service } = setup();
    await expect(service.preview({ ...base, type: "CASH_IN", cashAccountId: "other-cash", categoryAccountId: "revenue", amount: 1n, description: "Leak" })).rejects.toThrow(/not found/i);
  });
});

