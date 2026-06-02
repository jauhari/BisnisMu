import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreateAllocationRecord, CreatePaymentRecord, CreateWalletRecord, CreateWalletTransactionRecord, PaymentAuditEvent, PaymentRepository } from "../application/payment-repository";
import { CustomerSnapshot, CustomerWalletEntity, CustomerWalletTransactionEntity, PaymentAllocationEntity, PaymentStatus, PaymentTransactionEntity, ReceivableEntity, TenantContext } from "../domain/payment-types";

const groupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    if (accountIds.length === 0) return [];
    const rows = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return rows.map((account) => ({ id: account.id, businessId: account.businessId, code: account.code, name: account.name, groupCode: groupByPrisma[account.groupCode] as AccountGroupCode, normalBalance: account.normalBalance, subtype: account.subtype, isPostingAllowed: account.isPostingAllowed, isActive: account.isActive }));
  }

  async findCustomer(ctx: TenantContext, customerId: string): Promise<CustomerSnapshot | null> {
    const row = await this.prisma.customer.findFirst({ where: { businessId: ctx.businessId, id: customerId } });
    return row ? { id: row.id, businessId: row.businessId, name: row.name, isActive: row.isActive } : null;
  }

  async createCustomerWallet(ctx: TenantContext, input: CreateWalletRecord): Promise<CustomerWalletEntity> {
    const row = await this.prisma.customerWallet.create({ data: { businessId: ctx.businessId, customerId: input.customerId, depositLiabilityAccountId: input.depositLiabilityAccountId, currentBalance: input.openingBalance ?? 0n } });
    return this.toWallet(row);
  }

  async findCustomerWallet(ctx: TenantContext, walletId: string): Promise<CustomerWalletEntity | null> {
    const row = await this.prisma.customerWallet.findFirst({ where: { businessId: ctx.businessId, id: walletId } });
    return row ? this.toWallet(row) : null;
  }

  async findWalletByCustomer(ctx: TenantContext, customerId: string): Promise<CustomerWalletEntity | null> {
    const row = await this.prisma.customerWallet.findFirst({ where: { businessId: ctx.businessId, customerId } });
    return row ? this.toWallet(row) : null;
  }

  async updateWalletBalance(ctx: TenantContext, walletId: string, balance: bigint): Promise<CustomerWalletEntity> {
    const row = await this.prisma.customerWallet.update({ where: { id: walletId, businessId: ctx.businessId }, data: { currentBalance: balance } });
    return this.toWallet(row);
  }

  async createWalletTransaction(ctx: TenantContext, input: CreateWalletTransactionRecord): Promise<CustomerWalletTransactionEntity> {
    const row = await this.prisma.customerWalletTransaction.create({ data: { businessId: ctx.businessId, walletId: input.walletId, customerId: input.customerId, type: input.type, transactionDate: input.transactionDate, amount: input.amount, balanceAfter: input.balanceAfter, description: input.description, postedJournalId: input.postedJournalId, createdByUserId: ctx.actorUserId } });
    return this.toWalletTransaction(row);
  }

  async listWalletTransactions(ctx: TenantContext, walletId: string): Promise<CustomerWalletTransactionEntity[]> {
    const rows = await this.prisma.customerWalletTransaction.findMany({ where: { businessId: ctx.businessId, walletId }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }] });
    return rows.map((row) => this.toWalletTransaction(row));
  }

  async nextPaymentNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "PAY-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.paymentTransaction.findFirst({ where: { businessId: ctx.businessId, paymentNumber: { startsWith: prefix } }, orderBy: { paymentNumber: "desc" } });
    const next = latest ? Number(latest.paymentNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async createPayment(ctx: TenantContext, input: CreatePaymentRecord): Promise<PaymentTransactionEntity> {
    const row = await this.prisma.paymentTransaction.create({ data: { businessId: ctx.businessId, paymentNumber: input.paymentNumber, customerId: input.customerId, transactionDate: input.transactionDate, totalAmount: input.totalAmount, allocatedAmount: 0n, status: "UNPAID", description: input.description, revenueSettlementAccountId: input.revenueSettlementAccountId, arAccountId: input.arAccountId ?? null, createdByUserId: ctx.actorUserId } });
    return this.toPayment(row);
  }

  async findPayment(ctx: TenantContext, paymentTransactionId: string): Promise<PaymentTransactionEntity | null> {
    const row = await this.prisma.paymentTransaction.findFirst({ where: { businessId: ctx.businessId, id: paymentTransactionId } });
    return row ? this.toPayment(row) : null;
  }

  async listPayments(ctx: TenantContext): Promise<PaymentTransactionEntity[]> {
    const rows = await this.prisma.paymentTransaction.findMany({ where: { businessId: ctx.businessId }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }] });
    return rows.map((row) => this.toPayment(row));
  }

  async updatePaymentAllocated(ctx: TenantContext, paymentTransactionId: string, allocatedAmount: bigint, status: PaymentStatus): Promise<PaymentTransactionEntity> {
    const row = await this.prisma.paymentTransaction.update({ where: { id: paymentTransactionId, businessId: ctx.businessId }, data: { allocatedAmount, status } });
    return this.toPayment(row);
  }

  async listAllocations(ctx: TenantContext, paymentTransactionId: string): Promise<PaymentAllocationEntity[]> {
    const rows = await this.prisma.paymentAllocation.findMany({ where: { businessId: ctx.businessId, paymentTransactionId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => this.toAllocation(row));
  }

  async createAllocation(ctx: TenantContext, input: CreateAllocationRecord): Promise<PaymentAllocationEntity> {
    const row = await this.prisma.paymentAllocation.create({ data: { businessId: ctx.businessId, paymentTransactionId: input.paymentTransactionId, method: input.method, amount: input.amount, accountId: input.accountId ?? null, walletId: input.walletId ?? null, floatAccountId: input.floatAccountId ?? null, receivableId: input.receivableId ?? null, postedJournalId: input.postedJournalId } });
    return this.toAllocation(row);
  }

  async findReceivable(ctx: TenantContext, receivableId: string): Promise<ReceivableEntity | null> {
    const row = await this.prisma.receivable.findFirst({ where: { businessId: ctx.businessId, id: receivableId } });
    return row ? this.toReceivable(row) : null;
  }

  async updateReceivablePaid(ctx: TenantContext, receivableId: string, paidAmount: bigint, status: PaymentStatus): Promise<ReceivableEntity> {
    const row = await this.prisma.receivable.update({ where: { id: receivableId, businessId: ctx.businessId }, data: { paidAmount, status } });
    return this.toReceivable(row);
  }

  async createAuditLog(ctx: TenantContext, event: PaymentAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action as any, entityType: event.entityType, entityId: event.entityId ?? null, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  private toWallet(row: any): CustomerWalletEntity { return { id: row.id, businessId: row.businessId, customerId: row.customerId, depositLiabilityAccountId: row.depositLiabilityAccountId, currentBalance: row.currentBalance, isActive: row.isActive }; }
  private toWalletTransaction(row: any): CustomerWalletTransactionEntity { return { id: row.id, businessId: row.businessId, walletId: row.walletId, customerId: row.customerId, type: row.type, transactionDate: row.transactionDate, amount: row.amount, balanceAfter: row.balanceAfter, description: row.description, postedJournalId: row.postedJournalId, createdByUserId: row.createdByUserId }; }
  private toPayment(row: any): PaymentTransactionEntity { return { id: row.id, businessId: row.businessId, paymentNumber: row.paymentNumber, customerId: row.customerId, transactionDate: row.transactionDate, totalAmount: row.totalAmount, allocatedAmount: row.allocatedAmount, status: row.status, description: row.description, revenueSettlementAccountId: row.revenueSettlementAccountId, arAccountId: row.arAccountId, postedJournalId: row.postedJournalId, createdByUserId: row.createdByUserId }; }
  private toAllocation(row: any): PaymentAllocationEntity { return { id: row.id, businessId: row.businessId, paymentTransactionId: row.paymentTransactionId, method: row.method, amount: row.amount, accountId: row.accountId, walletId: row.walletId, floatAccountId: row.floatAccountId, receivableId: row.receivableId, postedJournalId: row.postedJournalId }; }
  private toReceivable(row: any): ReceivableEntity { return { id: row.id, businessId: row.businessId, customerId: row.customerId, totalAmount: row.totalAmount, paidAmount: row.paidAmount, status: row.status, arAccountId: row.arAccountId }; }
}
