import { PaymentAllocationInput } from "../../payment/domain/payment-types";
import { SalesItemInput } from "../../sales/domain/sales-types";

export type PosSessionStatus = "OPEN" | "CLOSED";
export type PosTransactionStatus = "DRAFT" | "CHECKOUT" | "PARTIALLY_PAID" | "PAID" | "VOID";
export type PosChangePolicy = "RETURN_CHANGE" | "SAVE_TO_DEPOSIT";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface PosTerminalEntity { id: string; businessId: string; name: string; cashDrawerId?: string | null; isActive: boolean; }
export interface PosSessionEntity { id: string; businessId: string; terminalId: string; cashSessionId?: string | null; status: PosSessionStatus; openedAt: Date; closedAt?: Date | null; openingAmount: bigint; expectedClosingAmount: bigint; countedClosingAmount?: bigint | null; differenceAmount?: bigint | null; openedByUserId: string; closedByUserId?: string | null; shiftCode?: string | null; }
export interface PosCartItemEntity { id: string; businessId: string; transactionId: string; productId: string; quantity: bigint; unitPrice?: bigint | null; priceId?: string | null; discountAmount: bigint; discountPercentBps: bigint; taxAmount: bigint; locationId?: string | null; providerProductId?: string | null; barcode?: string | null; }
export interface PosTransactionEntity { id: string; businessId: string; sessionId: string; transactionNumber: string; customerId: string; status: PosTransactionStatus; transactionDate: Date; subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint; paidAmount: bigint; changeAmount: bigint; salesOrderId?: string | null; paymentTransactionId?: string | null; receiptId?: string | null; createdByUserId: string; items: PosCartItemEntity[]; }
export interface PosReceiptEntity { id: string; businessId: string; transactionId: string; receiptNumber: string; issuedAt: Date; totalAmount: bigint; paidAmount: bigint; changeAmount: bigint; }

export interface OpenPosSessionInput { businessId: string; terminalId: string; openedAt: Date; openingAmount: bigint; equityAccountId: string; shiftCode?: string; }
export interface ClosePosSessionInput { businessId: string; sessionId: string; closedAt: Date; countedAmount: bigint; differenceAccountId: string; }
export interface AddCartItemInput { businessId: string; sessionId: string; transactionId?: string; customerId: string; productId?: string; barcode?: string; quantity: bigint; unitPrice?: bigint; priceId?: string; discountAmount?: bigint; discountPercentBps?: bigint; taxAmount?: bigint; locationId?: string; providerProductId?: string; }
export interface RemoveCartItemInput { businessId: string; transactionId: string; cartItemId: string; }
export interface CheckoutTransactionInput { businessId: string; transactionId: string; saleDate: Date; description: string; revenueSettlementAccountId: string; arAccountId?: string; }
export interface AllocatePosPaymentInput { businessId: string; transactionId: string; allocations: PaymentAllocationInput[]; changePolicy?: PosChangePolicy; depositWalletId?: string; depositCashAccountId?: string; }
export interface SaveChangeAsDepositInput { businessId: string; transactionId: string; walletId: string; cashAccountId: string; }
export interface VoidTransactionInput { businessId: string; transactionId: string; reason: string; }

export class PosError extends Error { constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) { super(message); this.name = "PosError"; } }

export function cartItemToSalesItem(item: PosCartItemEntity): SalesItemInput {
  const input: SalesItemInput = { productId: item.productId, quantity: item.quantity, discountAmount: item.discountAmount, taxAmount: item.taxAmount };
  if (item.unitPrice !== null && item.unitPrice !== undefined) input.unitPrice = item.unitPrice;
  if (item.priceId !== null && item.priceId !== undefined) input.priceId = item.priceId;
  if (item.locationId !== null && item.locationId !== undefined) input.locationId = item.locationId;
  if (item.providerProductId !== null && item.providerProductId !== undefined) input.providerProductId = item.providerProductId;
  return input;
}
