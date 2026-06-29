import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { InventoryService } from "../../inventory/application/inventory-service";
import { PaymentService } from "../../payment/application/payment-service";
import { PaymentAllocationInput } from "../../payment/domain/payment-types";
import { SalesEngine } from "../domain/sales-engine";
import { SalesError, TenantContext } from "../domain/sales-types";
import { AllocateSalesPaymentCommand, ConfirmSalesOrderCommand, CreateSalesOrderCommand, DeleteSalesOrderCommand, SalesRepository, UpdateSalesOrderCommand, VoidSalesOrderCommand } from "./sales-repository";

export class SalesService {
  constructor(private readonly repo: SalesRepository, private readonly journal: JournalPostingService, private readonly inventory: InventoryService, private readonly payment: PaymentService, private readonly engine = new SalesEngine()) {}

  async createSalesOrder(command: CreateSalesOrderCommand) {
    const ctx = this.ctx(command);
    const computed = await this.buildComputed(ctx, command);
    const sale = await this.repo.createSalesOrder(ctx, command, computed, await this.repo.nextSalesNumber(ctx, command.saleDate));
    await this.audit(ctx, "SALES_ORDER_CREATED", sale.id, { salesNumber: sale.salesNumber, totalAmount: sale.totalAmount.toString() });
    return sale;
  }

  async updateSalesOrder(command: UpdateSalesOrderCommand) {
    const ctx = this.ctx(command);
    const existing = await this.requireSale(ctx, command.salesOrderId);
    if (existing.status !== "DRAFT") throw new SalesError("ONLY_DRAFT_CAN_BE_UPDATED", "Only draft sales orders can be updated.");
    const computed = await this.buildComputed(ctx, command);
    const sale = await this.repo.updateSalesOrder(ctx, command.salesOrderId, command, computed);
    await this.audit(ctx, "SALES_ORDER_UPDATED", sale.id, { salesNumber: sale.salesNumber, totalAmount: sale.totalAmount.toString() });
    return sale;
  }

  async updateAnySalesOrder(command: UpdateSalesOrderCommand) {
    const ctx = this.ctx(command);
    const existing = await this.requireSale(ctx, command.salesOrderId);
    const computed = await this.buildComputed(ctx, command);
    const sale = await this.repo.updateSalesOrder(ctx, command.salesOrderId, command, computed);
    if (sale.postedJournalId) {
      const accounts = await this.repo.findAccounts(ctx, [sale.revenueSettlementAccountId, sale.arAccountId].filter((id): id is string => Boolean(id)));
      const revenue = accounts.find((account) => account.id === sale.revenueSettlementAccountId);
      const debitAccount = sale.arAccountId ? accounts.find((account) => account.id === sale.arAccountId) : revenue;
      if (!revenue || !debitAccount) throw new SalesError("ACCOUNT_NOT_FOUND", "Settlement account was not found.");
      const preview = this.engine.previewRevenue(sale, revenue, debitAccount);
      await this.journal.replacePosted(sale.postedJournalId, { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: sale.saleDate, source: "SALES_REVENUE", sourceId: sale.id, description: sale.description, lines: preview.lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) });
    }
    await this.audit(ctx, "SALES_ORDER_UPDATED", sale.id, { salesNumber: sale.salesNumber, totalAmount: sale.totalAmount.toString(), previousStatus: existing.status, hardEdit: true });
    return sale;
  }

  async deleteSalesOrder(command: DeleteSalesOrderCommand) {
    const ctx = this.ctx(command);
    const sale = await this.requireSale(ctx, command.salesOrderId);
    if (sale.status !== "DRAFT") throw new SalesError("ONLY_DRAFT_CAN_BE_DELETED", "Only draft sales orders can be deleted.");
    await this.repo.deleteSalesOrder(ctx, sale.id);
    await this.audit(ctx, "SALES_ORDER_VOIDED", sale.id, { salesNumber: sale.salesNumber, deleted: true });
    return sale;
  }

  async deleteAnySalesOrder(command: DeleteSalesOrderCommand) {
    const ctx = this.ctx(command);
    const sale = await this.requireSale(ctx, command.salesOrderId);
    if (sale.postedJournalId) await this.journal.deletePosted(this.deleteJournalCommand(ctx, sale.postedJournalId));
    await this.repo.deleteAnySalesOrder(ctx, sale.id);
    await this.audit(ctx, "SALES_ORDER_VOIDED", sale.id, { salesNumber: sale.salesNumber, previousStatus: sale.status, hardDelete: true });
    return sale;
  }

  async voidSalesOrder(command: VoidSalesOrderCommand) {
    const ctx = this.ctx(command);
    if (command.reason.trim().length < 10) throw new SalesError("VOID_REASON_TOO_SHORT", "Void reason must be at least 10 characters.");
    const sale = await this.requireSale(ctx, command.salesOrderId);
    if (sale.status === "DRAFT") throw new SalesError("DRAFT_SHOULD_BE_DELETED", "Draft sales orders should be deleted instead of voided.");
    if (sale.status === "VOID") throw new SalesError("SALES_ORDER_ALREADY_VOID", "Sales order is already void.");
    const updated = await this.repo.updateSalesStatus(ctx, sale.id, "VOID", sale.paidAmount, sale.paymentTransactionId ?? undefined, sale.postedJournalId ?? undefined);
    await this.audit(ctx, "SALES_ORDER_VOIDED", sale.id, { salesNumber: sale.salesNumber, reason: command.reason.trim() });
    return updated;
  }

  private async buildComputed(ctx: TenantContext, command: CreateSalesOrderCommand) {
    const productIds = [...new Set(command.items.map((item) => item.productId))];
    const accountIds = [command.revenueSettlementAccountId, command.arAccountId].filter((id): id is string => Boolean(id));
    const [customer, products, prices, accounts] = await Promise.all([this.repo.findCustomer(ctx, command.customerId), this.repo.findProducts(ctx, productIds), this.repo.findPrices(ctx, productIds, command.saleDate), this.repo.findAccounts(ctx, accountIds)]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return this.engine.buildDraft(command, { customer, products, prices, revenueSettlementAccount: byId.get(command.revenueSettlementAccountId) ?? null, arAccount: command.arAccountId ? byId.get(command.arAccountId) ?? null : null });
  }

  async confirmSalesOrder(command: ConfirmSalesOrderCommand) {
    const ctx = this.ctx(command); const sale = await this.requireSale(ctx, command.salesOrderId); this.engine.confirm(sale);
    const accounts = await this.repo.findAccounts(ctx, [sale.revenueSettlementAccountId]); const revenue = accounts[0]; if (!revenue) throw new SalesError("ACCOUNT_NOT_FOUND", "Revenue account was not found.");
    const debitAccount = sale.arAccountId ? (await this.repo.findAccounts(ctx, [sale.arAccountId]))[0] : revenue;
    if (!debitAccount) throw new SalesError("ACCOUNT_NOT_FOUND", "Settlement account was not found.");
    const preview = this.engine.previewRevenue(sale, revenue, debitAccount);
    const posted = await this.post(ctx, sale.saleDate, "SALES_REVENUE", sale.id, sale.description, preview.lines, "sales-revenue:" + ctx.businessId + ":" + sale.id);
    for (const item of sale.items) {
      if (item.productType === "PHYSICAL") await this.inventory.stockOut({ businessId: ctx.businessId, actorUserId: ctx.actorUserId, productId: item.productId, locationId: item.locationId ?? "main", movementDate: sale.saleDate, quantity: item.quantity, description: "Sale " + sale.salesNumber });
      if (item.productType === "DIGITAL") {
        const command = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, productId: item.productId, transactionDate: sale.saleDate, quantity: item.quantity, description: "Sale " + sale.salesNumber };
        if (item.providerProductId !== null && item.providerProductId !== undefined) Object.assign(command, { providerProductId: item.providerProductId });
        await this.inventory.consumeDigitalProduct(command);
      }
    }
    const updated = await this.repo.updateSalesStatus(ctx, sale.id, "CONFIRMED", sale.paidAmount, undefined, posted.journalId);
    await this.audit(ctx, "SALES_ORDER_CONFIRMED", sale.id, { journalId: posted.journalId });
    return { sale: updated, journal: posted, preview };
  }

  async allocatePayment(command: AllocateSalesPaymentCommand) {
    const ctx = this.ctx(command); const sale = await this.requireSale(ctx, command.salesOrderId); if (!command.allocations || command.allocations.length === 0) throw new SalesError("PAYMENT_ALLOCATION_REQUIRED", "Payment allocation is required.");
    let paymentTransactionId = sale.paymentTransactionId;
    if (!paymentTransactionId) { const command = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, customerId: sale.customerId, transactionDate: sale.saleDate, totalAmount: sale.totalAmount, description: sale.description, revenueSettlementAccountId: sale.revenueSettlementAccountId }; if (sale.arAccountId !== null && sale.arAccountId !== undefined) Object.assign(command, { arAccountId: sale.arAccountId }); const payment = await this.payment.createPayment(command); paymentTransactionId = payment.id; }
    const result = await this.payment.allocatePayment({ businessId: ctx.businessId, actorUserId: ctx.actorUserId, paymentTransactionId, allocations: command.allocations as PaymentAllocationInput[] });
    const paidAmount = result.payment.allocatedAmount;
    const updated = await this.repo.updateSalesStatus(ctx, sale.id, this.engine.nextStatus(sale.totalAmount, paidAmount), paidAmount, paymentTransactionId, sale.postedJournalId ?? undefined);
    await this.audit(ctx, "SALES_PAYMENT_ALLOCATED", sale.id, { paidAmount: paidAmount.toString(), status: updated.status });
    return { sale: updated, payment: result };
  }

  private async requireSale(ctx: TenantContext, id: string) { const sale = await this.repo.findSalesOrder(ctx, id); if (!sale) throw new SalesError("SALES_ORDER_NOT_FOUND", "Sales order was not found in this business."); return sale; }
  private deleteJournalCommand(ctx: TenantContext, journalId: string) { const command: { businessId: string; actorUserId: string; journalId: string; requestId?: string; ipAddress?: string; userAgent?: string } = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, journalId }; if (ctx.requestId !== undefined) command.requestId = ctx.requestId; if (ctx.ipAddress !== undefined) command.ipAddress = ctx.ipAddress; if (ctx.userAgent !== undefined) command.userAgent = ctx.userAgent; return command; }
  private async post(ctx: TenantContext, date: Date, source: string, sourceId: string, description: string, lines: PostJournalCommand["lines"], idempotencyKey: string) { const command: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: date, source, sourceId, description, idempotencyKey, lines: lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) }; if (ctx.requestId !== undefined) command.requestId = ctx.requestId; if (ctx.ipAddress !== undefined) command.ipAddress = ctx.ipAddress; if (ctx.userAgent !== undefined) command.userAgent = ctx.userAgent; return this.journal.post(command); }
  private async audit(ctx: TenantContext, action: Parameters<SalesRepository["createAuditLog"]>[1]["action"], entityId: string, metadata: Record<string, unknown>) { await this.repo.createAuditLog(ctx, { action, businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType: "sales_order", entityId, metadata }); }
  private ctx(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext { const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId }; if (command.requestId !== undefined) ctx.requestId = command.requestId; if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress; if (command.userAgent !== undefined) ctx.userAgent = command.userAgent; return ctx; }
}
