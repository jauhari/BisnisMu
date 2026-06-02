import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { ArApService } from "../../ar-ap/application/ar-ap-service";
import { InventoryService } from "../../inventory/application/inventory-service";
import { PurchaseEngine } from "../domain/purchase-engine";
import { PurchaseError, TenantContext } from "../domain/purchase-types";
import { ApprovePurchaseOrderCommand, CreatePurchaseOrderCommand, CreatePurchaseReturnCommand, GenerateVendorBillCommand, PurchaseRepository, ReceivePurchaseOrderCommand } from "./purchase-repository";

export class PurchaseService {
  constructor(private readonly repo: PurchaseRepository, private readonly journal: JournalPostingService, private readonly inventory: InventoryService, private readonly arAp?: ArApService, private readonly engine = new PurchaseEngine()) {}

  async createPurchaseOrder(command: CreatePurchaseOrderCommand) {
    const ctx = this.ctx(command);
    const productIds = [...new Set(command.items.map((item) => item.productId))];
    const accountIds = [command.grniAccountId, command.apAccountId];
    const [supplier, products, accounts] = await Promise.all([this.repo.findSupplier(ctx, command.supplierId), this.repo.findProducts(ctx, productIds), this.repo.findAccounts(ctx, accountIds)]);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const totals = this.engine.validateCreateOrder(command, { supplier, products, grniAccount: byId.get(command.grniAccountId) ?? null, apAccount: byId.get(command.apAccountId) ?? null });
    const order = await this.repo.createPurchaseOrder(ctx, command, totals, await this.repo.nextOrderNumber(ctx, command.orderDate));
    await this.audit(ctx, "PURCHASE_ORDER_CREATED", "purchase_order", order.id, { orderNumber: order.orderNumber, totalAmount: order.totalAmount.toString() });
    return order;
  }

  async approvePurchaseOrder(command: ApprovePurchaseOrderCommand) {
    const ctx = this.ctx(command); const order = await this.requireOrder(ctx, command.purchaseOrderId); this.engine.approve(order);
    const approved = await this.repo.updatePurchaseOrderStatus(ctx, order.id, "APPROVED");
    await this.audit(ctx, "PURCHASE_ORDER_APPROVED", "purchase_order", approved.id, { orderNumber: approved.orderNumber });
    return approved;
  }

  async receivePurchaseOrder(command: ReceivePurchaseOrderCommand) {
    const ctx = this.ctx(command); const order = await this.requireOrder(ctx, command.purchaseOrderId); const plan = this.engine.receiptPlan(command, order);
    const products = await this.repo.findProducts(ctx, plan.itemReceipts.map((line) => line.item.productId));
    const inventoryAccountIds = [...new Set(products.map((product) => product.inventoryAccountId).filter((id): id is string => Boolean(id)))] ;
    const accounts = await this.repo.findAccounts(ctx, [...inventoryAccountIds, order.grniAccountId]);
    const preview = this.engine.previewReceipt(order, accounts, plan.totalCost, command.receiptDate);
    const journal = await this.post(ctx, command.receiptDate, "PURCHASE_RECEIPT", order.id, preview.description, preview.lines, "purchase-receipt:" + ctx.businessId + ":" + order.id + ":" + command.receiptDate.toISOString() + ":" + plan.totalCost.toString());
    for (const line of plan.itemReceipts) {
      await this.inventory.stockIn({ businessId: ctx.businessId, actorUserId: ctx.actorUserId, productId: line.item.productId, locationId: line.locationId, movementDate: command.receiptDate, quantity: line.quantity, unitCost: line.item.unitCost, description: "Receipt " + order.orderNumber });
      await this.repo.updateItemReceived(ctx, line.item.id, line.item.receivedQuantity + line.quantity);
    }
    const receipt = await this.repo.createReceipt(ctx, { purchaseOrderId: order.id, receiptNumber: await this.repo.nextReceiptNumber(ctx, command.receiptDate), receiptDate: command.receiptDate, totalCost: plan.totalCost, postedJournalId: journal.journalId });
    const updated = await this.repo.updatePurchaseOrderStatus(ctx, order.id, plan.status);
    await this.audit(ctx, "PURCHASE_ORDER_RECEIVED", "purchase_receipt", receipt.id, { totalCost: plan.totalCost.toString(), status: updated.status });
    return { order: updated, receipt, journal, preview };
  }

  async createPurchaseReturn(command: CreatePurchaseReturnCommand) {
    const ctx = this.ctx(command); const order = await this.requireOrder(ctx, command.purchaseOrderId); const plan = this.engine.returnPlan(command, order);
    const firstProduct = (await this.repo.findProducts(ctx, [plan.itemReturns[0]!.item.productId]))[0];
    const accounts = await this.repo.findAccounts(ctx, [firstProduct?.inventoryAccountId, order.apAccountId].filter((id): id is string => Boolean(id)));
    const inventoryAccount = accounts.find((a) => a.id === firstProduct?.inventoryAccountId); const apAccount = accounts.find((a) => a.id === order.apAccountId);
    if (!inventoryAccount || !apAccount) throw new PurchaseError("ACCOUNT_NOT_FOUND", "Return accounts were not found.");
    const preview = this.engine.previewReturn(order, inventoryAccount, apAccount, plan.totalCost, command.returnDate);
    const journal = await this.post(ctx, command.returnDate, "PURCHASE_RETURN", order.id, preview.description, preview.lines, "purchase-return:" + ctx.businessId + ":" + order.id + ":" + command.returnDate.toISOString() + ":" + plan.totalCost.toString());
    for (const line of plan.itemReturns) await this.inventory.stockOut({ businessId: ctx.businessId, actorUserId: ctx.actorUserId, productId: line.item.productId, locationId: line.locationId, movementDate: command.returnDate, quantity: line.quantity, description: "Return " + order.orderNumber });
    const returned = await this.repo.createReturn(ctx, { purchaseOrderId: order.id, returnNumber: await this.repo.nextReturnNumber(ctx, command.returnDate), returnDate: command.returnDate, totalCost: plan.totalCost, postedJournalId: journal.journalId });
    await this.audit(ctx, "PURCHASE_RETURN_CREATED", "purchase_return", returned.id, { totalCost: plan.totalCost.toString() });
    return { return: returned, journal, preview };
  }

  async generateVendorBill(command: GenerateVendorBillCommand) {
    const ctx = this.ctx(command); const order = await this.requireOrder(ctx, command.purchaseOrderId); if (!["RECEIVED", "COMPLETED"].includes(order.status)) throw new PurchaseError("PURCHASE_NOT_BILLABLE", "Only received purchase orders can generate vendor bills.");
    const [grni, ap] = await this.repo.findAccounts(ctx, [order.grniAccountId, order.apAccountId]); if (!grni || !ap) throw new PurchaseError("ACCOUNT_NOT_FOUND", "GRNI or AP account was not found.");
    const preview = this.engine.previewInvoice(order, grni, ap, order.totalAmount, command.billDate, command.description);
    const journal = await this.post(ctx, command.billDate, "PURCHASE_VENDOR_BILL", order.id, command.description, preview.lines, "purchase-vendor-bill:" + ctx.businessId + ":" + order.id + ":" + order.totalAmount.toString());
    let bill: unknown = null;
    if (this.arAp) {
      bill = await this.arAp.createBill({ businessId: ctx.businessId, actorUserId: ctx.actorUserId, vendorId: order.supplierId, issueDate: command.billDate, dueDate: command.dueDate, apAccountId: order.apAccountId, expenseAccountId: command.expenseAccountId ?? order.grniAccountId, subtotal: order.totalAmount, description: command.description });
    }
    const completed = await this.repo.updatePurchaseOrderStatus(ctx, order.id, "COMPLETED");
    await this.audit(ctx, "PURCHASE_VENDOR_BILL_GENERATED", "vendor_bill", order.id, { journalId: journal.journalId, totalAmount: order.totalAmount.toString() });
    return { order: completed, bill, journal, preview };
  }

  private async requireOrder(ctx: TenantContext, id: string) { const order = await this.repo.findPurchaseOrder(ctx, id); if (!order) throw new PurchaseError("PURCHASE_ORDER_NOT_FOUND", "Purchase order was not found in this business."); return order; }
  private async post(ctx: TenantContext, date: Date, source: string, sourceId: string, description: string, lines: PostJournalCommand["lines"], idempotencyKey: string) { const command: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: date, source, sourceId, description, idempotencyKey, lines: lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) }; if (ctx.requestId !== undefined) command.requestId = ctx.requestId; if (ctx.ipAddress !== undefined) command.ipAddress = ctx.ipAddress; if (ctx.userAgent !== undefined) command.userAgent = ctx.userAgent; return this.journal.post(command); }
  private async audit(ctx: TenantContext, action: Parameters<PurchaseRepository["createAuditLog"]>[1]["action"], entityType: Parameters<PurchaseRepository["createAuditLog"]>[1]["entityType"], entityId: string, metadata: Record<string, unknown>) { await this.repo.createAuditLog(ctx, { action, businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType, entityId, metadata }); }
  private ctx(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext { const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId }; if (command.requestId !== undefined) ctx.requestId = command.requestId; if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress; if (command.userAgent !== undefined) ctx.userAgent = command.userAgent; return ctx; }
}
