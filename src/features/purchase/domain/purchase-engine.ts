import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreatePurchaseOrderInput, CreatePurchaseReturnInput, PurchaseError, PurchaseJournalPreview, PurchaseOrderEntity, PurchaseOrderItemEntity, PurchaseOrderItemInput, PurchaseValidationContext, ReceivePurchaseOrderInput } from "./purchase-types";

export class PurchaseEngine {
  validateCreateOrder(input: CreatePurchaseOrderInput, context: PurchaseValidationContext): { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint } {
    if (!input.businessId) throw new PurchaseError("TENANT_REQUIRED", "businessId is required.");
    if (!context.supplier || context.supplier.businessId !== input.businessId || !context.supplier.isActive) throw new PurchaseError("SUPPLIER_NOT_AVAILABLE", "Supplier is not available in this business.");
    if (input.items.length === 0) throw new PurchaseError("PURCHASE_ITEMS_REQUIRED", "Purchase order requires at least one item.");
    this.assertLiability(input.grniAccountId, context.grniAccount ?? null, input.businessId, "grniAccountId"); this.assertLiability(input.apAccountId, context.apAccount ?? null, input.businessId, "apAccountId");
    const products = new Map((context.products ?? []).map((p) => [p.id, p]));
    let subtotal = 0n, discountTotal = 0n, taxTotal = 0n;
    for (const item of input.items) { this.validateItem(item); const product = products.get(item.productId); if (!product || product.businessId !== input.businessId || !product.isActive) throw new PurchaseError("PRODUCT_NOT_FOUND", "Purchase product was not found in this business.", { productId: item.productId }); const gross = item.quantity * item.unitCost; const discount = item.discountAmount ?? 0n; const tax = item.taxAmount ?? 0n; if (discount < 0n || tax < 0n || discount > gross) throw new PurchaseError("INVALID_DISCOUNT_OR_TAX", "Discount and tax amounts are invalid."); subtotal += gross; discountTotal += discount; taxTotal += tax; }
    return { subtotal, discountTotal, taxTotal, totalAmount: subtotal - discountTotal + taxTotal };
  }

  approve(order: PurchaseOrderEntity): void { if (order.status !== "DRAFT") throw new PurchaseError("ONLY_DRAFT_CAN_BE_APPROVED", "Only draft purchase orders can be approved."); }

  receiptPlan(input: ReceivePurchaseOrderInput, order: PurchaseOrderEntity | null): { totalCost: bigint; status: PurchaseOrderEntity["status"]; itemReceipts: Array<{ item: PurchaseOrderItemEntity; quantity: bigint; cost: bigint; locationId: string }> } {
    if (!order || order.businessId !== input.businessId) throw new PurchaseError("PURCHASE_ORDER_NOT_FOUND", "Purchase order was not found in this business.");
    if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)) throw new PurchaseError("PURCHASE_NOT_RECEIVABLE", "Only approved or partially received purchase orders can be received.");
    if (input.items.length === 0) throw new PurchaseError("RECEIPT_ITEMS_REQUIRED", "Receipt requires at least one item.");
    const byProduct = new Map(order.items.map((item) => [item.productId, item]));
    const itemReceipts = input.items.map((line) => { if (line.quantity <= 0n) throw new PurchaseError("INVALID_QUANTITY", "Receipt quantity must be greater than zero."); const item = byProduct.get(line.productId); if (!item) throw new PurchaseError("PURCHASE_ITEM_NOT_FOUND", "Receipt item is not on the purchase order.", { productId: line.productId }); const remaining = item.quantity - item.receivedQuantity; if (line.quantity > remaining) throw new PurchaseError("OVER_RECEIPT", "Receipt quantity cannot exceed remaining order quantity.", { remaining: remaining.toString() }); return { item, quantity: line.quantity, cost: line.quantity * item.unitCost, locationId: line.locationId }; });
    const totalCost = itemReceipts.reduce((sum, line) => sum + line.cost, 0n);
    const receivedByProduct = new Map(itemReceipts.map((line) => [line.item.productId, line.quantity]));
    const fullyReceived = order.items.every((item) => item.receivedQuantity + (receivedByProduct.get(item.productId) ?? 0n) >= item.quantity);
    return { totalCost, status: fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED", itemReceipts };
  }

  returnPlan(input: CreatePurchaseReturnInput, order: PurchaseOrderEntity | null): { totalCost: bigint; itemReturns: Array<{ item: PurchaseOrderItemEntity; quantity: bigint; cost: bigint; locationId: string }> } {
    if (!order || order.businessId !== input.businessId) throw new PurchaseError("PURCHASE_ORDER_NOT_FOUND", "Purchase order was not found in this business.");
    if (!["RECEIVED", "PARTIALLY_RECEIVED", "COMPLETED"].includes(order.status)) throw new PurchaseError("PURCHASE_NOT_RETURNABLE", "Only received purchase orders can be returned.");
    const byProduct = new Map(order.items.map((item) => [item.productId, item]));
    const itemReturns = input.items.map((line) => { if (line.quantity <= 0n) throw new PurchaseError("INVALID_QUANTITY", "Return quantity must be greater than zero."); const item = byProduct.get(line.productId); if (!item) throw new PurchaseError("PURCHASE_ITEM_NOT_FOUND", "Return item is not on the purchase order."); if (line.quantity > item.receivedQuantity) throw new PurchaseError("OVER_RETURN", "Return quantity cannot exceed received quantity."); return { item, quantity: line.quantity, cost: line.quantity * item.unitCost, locationId: line.locationId }; });
    return { totalCost: itemReturns.reduce((sum, line) => sum + line.cost, 0n), itemReturns };
  }

  previewReceipt(order: PurchaseOrderEntity, accounts: AccountSnapshot[], totalCost: bigint, date: Date): PurchaseJournalPreview { const inventory = accounts[0]; if (!inventory) throw new PurchaseError("ACCOUNT_NOT_FOUND", "Inventory account was not found."); return this.preview(order.businessId, date, "PURCHASE_RECEIPT", "Receive " + order.orderNumber, [this.line(inventory, "DEBIT", totalCost), this.line(this.account(order.grniAccountId, accounts), "CREDIT", totalCost)]); }
  previewInvoice(order: PurchaseOrderEntity, grni: AccountSnapshot, ap: AccountSnapshot, amount: bigint, date: Date, description: string): PurchaseJournalPreview { return this.preview(order.businessId, date, "PURCHASE_VENDOR_BILL", description, [this.line(grni, "DEBIT", amount), this.line(ap, "CREDIT", amount)]); }
  previewReturn(order: PurchaseOrderEntity, inventory: AccountSnapshot, ap: AccountSnapshot, totalCost: bigint, date: Date): PurchaseJournalPreview { return this.preview(order.businessId, date, "PURCHASE_RETURN", "Return " + order.orderNumber, [this.line(ap, "DEBIT", totalCost), this.line(inventory, "CREDIT", totalCost)]); }

  private validateItem(item: PurchaseOrderItemInput): void { if (item.quantity <= 0n) throw new PurchaseError("INVALID_QUANTITY", "Purchase quantity must be greater than zero."); if (item.unitCost <= 0n) throw new PurchaseError("INVALID_UNIT_COST", "Purchase unit cost must be greater than zero."); }
  private account(id: string, accounts: AccountSnapshot[]): AccountSnapshot { const account = accounts.find((a) => a.id === id); if (!account) throw new PurchaseError("ACCOUNT_NOT_FOUND", "Account was not found."); return account; }
  private assertLiability(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { if (!account) throw new PurchaseError("ACCOUNT_NOT_FOUND", "Account was not found in this business.", { field, accountId: id }); if (account.businessId !== businessId) throw new PurchaseError("TENANT_ACCOUNT_MISMATCH", "Account must belong to the same business."); if (!account.isActive || !account.isPostingAllowed || account.groupCode !== 2) throw new PurchaseError("ACCOUNT_NOT_LIABILITY", "Account must be an active liability account.", { field, accountId: id }); }
  private preview(businessId: string, transactionDate: Date, source: string, description: string, lines: PurchaseJournalPreview["lines"]): PurchaseJournalPreview { const totalDebit = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0n); const totalCredit = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0n); return { businessId, transactionDate, source, description, lines, totalDebit, totalCredit }; }
  private line(account: AccountSnapshot, side: "DEBIT" | "CREDIT", amount: bigint) { return { accountId: account.id, side, amount, accountCode: account.code, accountName: account.name }; }
}
