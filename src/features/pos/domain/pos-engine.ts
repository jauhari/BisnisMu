import { AddCartItemInput, PosError, PosSessionEntity, PosTerminalEntity, PosTransactionEntity } from "./pos-types";

export class PosEngine {
  validateOpen(terminal: PosTerminalEntity | null, businessId: string, openingAmount: bigint): void {
    if (!terminal || terminal.businessId !== businessId || !terminal.isActive) throw new PosError("TERMINAL_NOT_AVAILABLE", "POS terminal is not available in this business.");
    if (openingAmount < 0n) throw new PosError("INVALID_OPENING_AMOUNT", "Opening amount cannot be negative.");
  }
  validateOpenSession(session: PosSessionEntity | null, businessId: string): PosSessionEntity {
    if (!session || session.businessId !== businessId) throw new PosError("POS_SESSION_NOT_FOUND", "POS session was not found in this business.");
    if (session.status !== "OPEN") throw new PosError("POS_SESSION_NOT_OPEN", "POS session is not open.");
    return session;
  }
  validateAddItem(input: AddCartItemInput, session: PosSessionEntity | null): void { this.validateOpenSession(session, input.businessId); if ((input.productId ? 1 : 0) + (input.barcode ? 1 : 0) !== 1) throw new PosError("PRODUCT_LOOKUP_REQUIRED", "Cart item requires productId or barcode."); if (input.quantity <= 0n) throw new PosError("INVALID_QUANTITY", "Cart quantity must be greater than zero."); if ((input.discountAmount ?? 0n) < 0n || (input.taxAmount ?? 0n) < 0n || (input.discountPercentBps ?? 0n) < 0n) throw new PosError("INVALID_DISCOUNT_OR_TAX", "Discount and tax cannot be negative."); }
  validateDraft(tx: PosTransactionEntity | null, businessId: string): PosTransactionEntity { if (!tx || tx.businessId !== businessId) throw new PosError("POS_TRANSACTION_NOT_FOUND", "POS transaction was not found in this business."); if (tx.status !== "DRAFT") throw new PosError("POS_TRANSACTION_NOT_DRAFT", "POS transaction must be draft."); return tx; }
  validatePayable(tx: PosTransactionEntity | null, businessId: string): PosTransactionEntity { if (!tx || tx.businessId !== businessId) throw new PosError("POS_TRANSACTION_NOT_FOUND", "POS transaction was not found in this business."); if (!["CHECKOUT", "PARTIALLY_PAID"].includes(tx.status)) throw new PosError("POS_TRANSACTION_NOT_PAYABLE", "POS transaction is not payable."); return tx; }
  totals(items: Array<{ quantity: bigint; unitPrice?: bigint | null; discountAmount: bigint; discountPercentBps: bigint; taxAmount: bigint }>): { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint } { let subtotal = 0n, discountTotal = 0n, taxTotal = 0n; for (const item of items) { const price = item.unitPrice ?? 0n; const gross = item.quantity * price; const percentDiscount = (gross * item.discountPercentBps) / 10000n; subtotal += gross; discountTotal += item.discountAmount + percentDiscount; taxTotal += item.taxAmount; } return { subtotal, discountTotal, taxTotal, totalAmount: subtotal - discountTotal + taxTotal }; }
  nextStatus(total: bigint, paid: bigint): "PARTIALLY_PAID" | "PAID" { if (paid < total) return "PARTIALLY_PAID"; return "PAID"; }
}
