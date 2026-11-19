import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CashAuditEvent, CashRepository } from "../application/cash-repository";
import { CashTransactionDraftInput, CashTransactionEntity, ContactEntity, CreateContactInput, TenantContext } from "../domain/cash-types";
import type { TxClient } from "../../shared/tx";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaCashRepository implements CashRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    const accounts = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return accounts.map((account) => ({ id: account.id, businessId: account.businessId, code: account.code, name: account.name, groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode, normalBalance: account.normalBalance, subtype: account.subtype, isPostingAllowed: account.isPostingAllowed, isActive: account.isActive }));
  }

  async findContact(ctx: TenantContext, contactId: string): Promise<ContactEntity | null> {
    const contact = await this.prisma.contact.findFirst({ where: { businessId: ctx.businessId, id: contactId } });
    return contact ? this.toContact(contact) : null;
  }

  async createContact(ctx: TenantContext, input: CreateContactInput): Promise<ContactEntity> {
    const contact = await this.prisma.contact.create({ data: { businessId: ctx.businessId, name: input.name.trim(), type: input.type ?? "OTHER", email: input.email ?? null, phone: input.phone ?? null, address: input.address ?? null } });
    return this.toContact(contact);
  }

  async nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string> {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const prefix = "CASH-" + y + m + "-";
    const latest = await this.prisma.cashTransaction.findFirst({ where: { businessId: ctx.businessId, transactionNumber: { startsWith: prefix } }, orderBy: { transactionNumber: "desc" } });
    const next = latest ? Number(latest.transactionNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async createDraft(ctx: TenantContext, input: CashTransactionDraftInput, transactionNumber: string): Promise<CashTransactionEntity> {
    const tx = await this.prisma.cashTransaction.create({ data: this.toCreateData(ctx, input, transactionNumber) });
    return this.toCashTransaction(tx);
  }

  async updateDraft(ctx: TenantContext, transactionId: string, input: CashTransactionDraftInput): Promise<CashTransactionEntity> {
    const tx = await this.prisma.cashTransaction.update({ where: { id: transactionId, businessId: ctx.businessId }, data: this.toUpdateData(input) });
    return this.toCashTransaction(tx);
  }

  async findTransaction(ctx: TenantContext, transactionId: string): Promise<CashTransactionEntity | null> {
    const tx = await this.prisma.cashTransaction.findFirst({ where: { businessId: ctx.businessId, id: transactionId } });
    return tx ? this.toCashTransaction(tx) : null;
  }

  async markPosted(ctx: TenantContext, transactionId: string, journalId: string, dbTx?: TxClient): Promise<CashTransactionEntity> {
    const client = (dbTx as Prisma.TransactionClient) ?? this.prisma;
    const tx = await client.cashTransaction.update({ where: { id: transactionId, businessId: ctx.businessId }, data: { status: "POSTED", postedJournalId: journalId, postedByUserId: ctx.actorUserId, postedAt: new Date() } });
    return this.toCashTransaction(tx);
  }

  async markVoided(ctx: TenantContext, transactionId: string, journalId: string, reason: string, dbTx?: TxClient): Promise<CashTransactionEntity> {
    const client = (dbTx as Prisma.TransactionClient) ?? this.prisma;
    const tx = await client.cashTransaction.update({ where: { id: transactionId, businessId: ctx.businessId }, data: { status: "VOID", voidJournalId: journalId, voidReason: reason, voidedByUserId: ctx.actorUserId, voidedAt: new Date() } });
    return this.toCashTransaction(tx);
  }

  async deleteDraft(ctx: TenantContext, transactionId: string): Promise<boolean> {
    const result = await this.prisma.cashTransaction.deleteMany({ where: { id: transactionId, businessId: ctx.businessId, status: "DRAFT" } });
    return result.count > 0;
  }

  async deleteAny(ctx: TenantContext, transactionId: string): Promise<boolean> {
    const result = await this.prisma.cashTransaction.deleteMany({ where: { id: transactionId, businessId: ctx.businessId } });
    return result.count > 0;
  }

  async createAuditLog(ctx: TenantContext, event: CashAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action, entityType: event.entityType, entityId: event.entityId ?? null, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  private toCreateData(ctx: TenantContext, input: CashTransactionDraftInput, transactionNumber: string): Prisma.CashTransactionUncheckedCreateInput {
    return { businessId: ctx.businessId, transactionNumber, type: input.type, status: "DRAFT", transactionDate: input.transactionDate, cashAccountId: input.cashAccountId, destinationAccountId: input.destinationAccountId ?? null, categoryAccountId: input.categoryAccountId ?? null, contactId: input.contactId ?? null, amount: input.amount, description: input.description.trim(), paymentMethod: input.paymentMethod ?? null, referenceNumber: input.referenceNumber ?? null, attachmentKey: input.attachmentKey ?? null, tags: input.tags ?? [], createdByUserId: ctx.actorUserId };
  }

  private toUpdateData(input: CashTransactionDraftInput): Prisma.CashTransactionUncheckedUpdateInput {
    return { type: input.type, transactionDate: input.transactionDate, cashAccountId: input.cashAccountId, destinationAccountId: input.destinationAccountId ?? null, categoryAccountId: input.categoryAccountId ?? null, contactId: input.contactId ?? null, amount: input.amount, description: input.description.trim(), paymentMethod: input.paymentMethod ?? null, referenceNumber: input.referenceNumber ?? null, attachmentKey: input.attachmentKey ?? null, tags: input.tags ?? [] };
  }

  private toContact(row: NonNullable<Awaited<ReturnType<PrismaClient["contact"]["findFirst"]>>>): ContactEntity {
    return { id: row.id, businessId: row.businessId, name: row.name, type: row.type, email: row.email, phone: row.phone, address: row.address, isActive: row.isActive };
  }

  private toCashTransaction(row: NonNullable<Awaited<ReturnType<PrismaClient["cashTransaction"]["findFirst"]>>>): CashTransactionEntity {
    return { id: row.id, businessId: row.businessId, transactionNumber: row.transactionNumber, type: row.type, status: row.status, transactionDate: row.transactionDate, cashAccountId: row.cashAccountId, destinationAccountId: row.destinationAccountId, categoryAccountId: row.categoryAccountId, contactId: row.contactId, amount: row.amount, description: row.description, paymentMethod: row.paymentMethod, referenceNumber: row.referenceNumber, attachmentKey: row.attachmentKey, tags: row.tags, postedJournalId: row.postedJournalId, voidJournalId: row.voidJournalId, voidReason: row.voidReason, createdByUserId: row.createdByUserId };
  }
}

