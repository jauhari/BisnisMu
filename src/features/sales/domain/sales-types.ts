import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";
import { ProductEntity, ProductPriceEntity, ProviderProductEntity } from "../../inventory/domain/inventory-types";
import { PaymentAllocationInput } from "../../payment/domain/payment-types";

export type SalesStatus = "DRAFT" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "VOID";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CustomerSnapshot { id: string; businessId: string; name: string; isActive: boolean; }
export interface SalesItemInput { productId: string; quantity: bigint; unitPrice?: bigint; priceId?: string; discountAmount?: bigint; taxAmount?: bigint; locationId?: string; providerProductId?: string; }
export interface CreateSalesOrderInput { businessId: string; customerId: string; saleDate: Date; description: string; revenueSettlementAccountId: string; arAccountId?: string; items: SalesItemInput[]; allocations?: PaymentAllocationInput[]; }
export interface AllocateSalePaymentInput { businessId: string; salesOrderId: string; allocations: PaymentAllocationInput[]; }

export interface SalesOrderItemEntity { id: string; businessId: string; salesOrderId: string; productId: string; productType: "PHYSICAL" | "DIGITAL" | "SERVICE"; quantity: bigint; unitPrice: bigint; discountAmount: bigint; taxAmount: bigint; lineTotal: bigint; locationId?: string | null; providerProductId?: string | null; }
export interface SalesOrderEntity { id: string; businessId: string; salesNumber: string; customerId: string; saleDate: Date; status: SalesStatus; description: string; subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint; paidAmount: bigint; revenueSettlementAccountId: string; arAccountId?: string | null; paymentTransactionId?: string | null; postedJournalId?: string | null; createdByUserId: string; items: SalesOrderItemEntity[]; }

export interface JournalPreviewLine extends JournalLineInput { accountCode: string; accountName: string; }
export interface SalesJournalPreview { businessId: string; transactionDate: Date; source: string; description: string; lines: JournalPreviewLine[]; totalDebit: bigint; totalCredit: bigint; }
export interface SalesValidationContext { customer?: CustomerSnapshot | null; products?: ProductEntity[]; prices?: ProductPriceEntity[]; providerProducts?: ProviderProductEntity[]; revenueSettlementAccount?: AccountSnapshot | null; arAccount?: AccountSnapshot | null; }

export class SalesError extends Error { constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) { super(message); this.name = "SalesError"; } }
