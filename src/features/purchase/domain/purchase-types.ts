import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";
import { ProductEntity } from "../../inventory/domain/inventory-types";

export type PurchaseOrderStatus = "DRAFT" | "APPROVED" | "RECEIVED" | "PARTIALLY_RECEIVED" | "COMPLETED" | "CANCELLED";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface SupplierSnapshot { id: string; businessId: string; name: string; isActive: boolean; }

export interface PurchaseOrderItemEntity { id: string; businessId: string; purchaseOrderId: string; productId: string; description?: string | null; quantity: bigint; receivedQuantity: bigint; unitCost: bigint; discountAmount: bigint; taxAmount: bigint; lineTotal: bigint; }
export interface PurchaseOrderEntity { id: string; businessId: string; orderNumber: string; supplierId: string; orderDate: Date; expectedDate?: Date | null; status: PurchaseOrderStatus; notes?: string | null; subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint; grniAccountId: string; apAccountId: string; createdByUserId: string; items: PurchaseOrderItemEntity[]; }
export interface PurchaseReceiptEntity { id: string; businessId: string; purchaseOrderId: string; receiptNumber: string; receiptDate: Date; totalCost: bigint; postedJournalId: string; createdByUserId: string; }
export interface PurchaseReturnEntity { id: string; businessId: string; purchaseOrderId: string; returnNumber: string; returnDate: Date; totalCost: bigint; postedJournalId: string; createdByUserId: string; }

export interface PurchaseOrderItemInput { productId: string; description?: string; quantity: bigint; unitCost: bigint; discountAmount?: bigint; taxAmount?: bigint; }
export interface CreatePurchaseOrderInput { businessId: string; supplierId: string; orderDate: Date; expectedDate?: Date; notes?: string; grniAccountId: string; apAccountId: string; items: PurchaseOrderItemInput[]; }
export interface ReceivePurchaseItemInput { productId: string; quantity: bigint; locationId: string; }
export interface ReceivePurchaseOrderInput { businessId: string; purchaseOrderId: string; receiptDate: Date; items: ReceivePurchaseItemInput[]; }
export interface PurchaseReturnItemInput { productId: string; quantity: bigint; locationId: string; }
export interface CreatePurchaseReturnInput { businessId: string; purchaseOrderId: string; returnDate: Date; items: PurchaseReturnItemInput[]; }
export interface GenerateVendorBillInput { businessId: string; purchaseOrderId: string; billDate: Date; dueDate: Date; description: string; expenseAccountId?: string; }

export interface JournalPreviewLine extends JournalLineInput { accountCode: string; accountName: string; }
export interface PurchaseJournalPreview { businessId: string; transactionDate: Date; source: string; description: string; lines: JournalPreviewLine[]; totalDebit: bigint; totalCredit: bigint; }

export interface PurchaseValidationContext { supplier?: SupplierSnapshot | null; order?: PurchaseOrderEntity | null; products?: ProductEntity[]; grniAccount?: AccountSnapshot | null; apAccount?: AccountSnapshot | null; inventoryAccounts?: AccountSnapshot[]; }

export class PurchaseError extends Error { constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) { super(message); this.name = "PurchaseError"; } }
