import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { ProductEntity } from "../../inventory/domain/inventory-types";
import { CreatePurchaseOrderInput, PurchaseOrderEntity, PurchaseOrderItemEntity, PurchaseReceiptEntity, PurchaseReturnEntity, SupplierSnapshot, TenantContext } from "../domain/purchase-types";

export interface PurchaseAuditEvent { action: "PURCHASE_ORDER_CREATED" | "PURCHASE_ORDER_APPROVED" | "PURCHASE_ORDER_RECEIVED" | "PURCHASE_RETURN_CREATED" | "PURCHASE_VENDOR_BILL_GENERATED"; businessId: string; actorUserId: string; entityType: "purchase_order" | "purchase_receipt" | "purchase_return" | "vendor_bill"; entityId?: string; metadata: Record<string, unknown>; }
export interface CreateReceiptRecord { purchaseOrderId: string; receiptNumber: string; receiptDate: Date; totalCost: bigint; postedJournalId: string; }
export interface CreateReturnRecord { purchaseOrderId: string; returnNumber: string; returnDate: Date; totalCost: bigint; postedJournalId: string; }

export interface PurchaseRepository {
  findSupplier(ctx: TenantContext, supplierId: string): Promise<SupplierSnapshot | null>;
  findProducts(ctx: TenantContext, productIds: string[]): Promise<ProductEntity[]>;
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  nextOrderNumber(ctx: TenantContext, date: Date): Promise<string>;
  nextReceiptNumber(ctx: TenantContext, date: Date): Promise<string>;
  nextReturnNumber(ctx: TenantContext, date: Date): Promise<string>;
  createPurchaseOrder(ctx: TenantContext, input: CreatePurchaseOrderInput, totals: { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint }, orderNumber: string): Promise<PurchaseOrderEntity>;
  findPurchaseOrder(ctx: TenantContext, purchaseOrderId: string): Promise<PurchaseOrderEntity | null>;
  updatePurchaseOrderStatus(ctx: TenantContext, purchaseOrderId: string, status: PurchaseOrderEntity["status"]): Promise<PurchaseOrderEntity>;
  updateItemReceived(ctx: TenantContext, itemId: string, receivedQuantity: bigint): Promise<PurchaseOrderItemEntity>;
  createReceipt(ctx: TenantContext, input: CreateReceiptRecord): Promise<PurchaseReceiptEntity>;
  createReturn(ctx: TenantContext, input: CreateReturnRecord): Promise<PurchaseReturnEntity>;
  createAuditLog(ctx: TenantContext, event: PurchaseAuditEvent): Promise<void>;
}

export interface Meta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreatePurchaseOrderCommand extends CreatePurchaseOrderInput, Meta {}
export interface ApprovePurchaseOrderCommand { businessId: string; purchaseOrderId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface ReceivePurchaseOrderCommand { businessId: string; purchaseOrderId: string; receiptDate: Date; items: Array<{ productId: string; quantity: bigint; locationId: string }>; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreatePurchaseReturnCommand { businessId: string; purchaseOrderId: string; returnDate: Date; items: Array<{ productId: string; quantity: bigint; locationId: string }>; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface GenerateVendorBillCommand { businessId: string; purchaseOrderId: string; billDate: Date; dueDate: Date; description: string; expenseAccountId?: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
