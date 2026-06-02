import { ProductEntity } from "../../inventory/domain/inventory-types";
import { AddCartItemInput, AllocatePosPaymentInput, CheckoutTransactionInput, ClosePosSessionInput, OpenPosSessionInput, PosCartItemEntity, PosReceiptEntity, PosSessionEntity, PosTerminalEntity, PosTransactionEntity, PosTransactionStatus, RemoveCartItemInput, SaveChangeAsDepositInput, TenantContext, VoidTransactionInput } from "../domain/pos-types";

export interface PosAuditEvent { action: "POS_SESSION_OPENED" | "POS_SESSION_CLOSED" | "POS_CART_UPDATED" | "POS_TRANSACTION_CHECKED_OUT" | "POS_PAYMENT_ALLOCATED" | "POS_CHANGE_SAVED_TO_DEPOSIT" | "POS_TRANSACTION_VOIDED"; businessId: string; actorUserId: string; entityType: "pos_session" | "pos_transaction" | "pos_receipt"; entityId?: string; metadata: Record<string, unknown>; }
export interface PosRepository {
  findTerminal(ctx: TenantContext, terminalId: string): Promise<PosTerminalEntity | null>;
  findOpenSessionByTerminal(ctx: TenantContext, terminalId: string): Promise<PosSessionEntity | null>;
  createSession(ctx: TenantContext, input: { terminalId: string; openedAt: Date; openingAmount: bigint; shiftCode?: string; cashSessionId?: string | null }): Promise<PosSessionEntity>;
  findSession(ctx: TenantContext, sessionId: string): Promise<PosSessionEntity | null>;
  closeSession(ctx: TenantContext, sessionId: string, closedAt: Date, countedAmount: bigint, differenceAmount: bigint): Promise<PosSessionEntity>;
  findProductByBarcode(ctx: TenantContext, barcode: string): Promise<ProductEntity | null>;
  findProduct(ctx: TenantContext, productId: string): Promise<ProductEntity | null>;
  nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string>;
  findTransaction(ctx: TenantContext, transactionId: string): Promise<PosTransactionEntity | null>;
  createTransaction(ctx: TenantContext, input: { sessionId: string; customerId: string; transactionDate: Date; transactionNumber: string }): Promise<PosTransactionEntity>;
  addCartItem(ctx: TenantContext, transactionId: string, input: AddCartItemInput, productId: string): Promise<PosCartItemEntity>;
  removeCartItem(ctx: TenantContext, transactionId: string, cartItemId: string): Promise<void>;
  updateTransactionTotals(ctx: TenantContext, transactionId: string, totals: { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint }): Promise<PosTransactionEntity>;
  updateTransactionStatus(ctx: TenantContext, transactionId: string, status: PosTransactionStatus, paidAmount?: bigint, changeAmount?: bigint, salesOrderId?: string, paymentTransactionId?: string, receiptId?: string): Promise<PosTransactionEntity>;
  nextReceiptNumber(ctx: TenantContext, date: Date): Promise<string>;
  createReceipt(ctx: TenantContext, transactionId: string, issuedAt: Date, totalAmount: bigint, paidAmount: bigint, changeAmount: bigint, receiptNumber: string): Promise<PosReceiptEntity>;
  createAuditLog(ctx: TenantContext, event: PosAuditEvent): Promise<void>;
}
export interface Meta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface OpenPosSessionCommand extends OpenPosSessionInput, Meta {}
export interface ClosePosSessionCommand extends ClosePosSessionInput, Meta {}
export interface AddCartItemCommand extends AddCartItemInput, Meta {}
export interface RemoveCartItemCommand extends RemoveCartItemInput, Meta {}
export interface CheckoutTransactionCommand extends CheckoutTransactionInput, Meta {}
export interface AllocatePosPaymentCommand extends AllocatePosPaymentInput, Meta {}
export interface SaveChangeAsDepositCommand extends SaveChangeAsDepositInput, Meta {}
export interface VoidTransactionCommand extends VoidTransactionInput, Meta {}
