import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { ProductPriceEntity } from "../../inventory/domain/inventory-types";
import { CreateSalesOrderInput, SalesError, SalesJournalPreview, SalesOrderEntity, SalesOrderItemEntity, SalesStatus, SalesValidationContext } from "./sales-types";

export class SalesEngine {
  buildDraft(input: CreateSalesOrderInput, context: SalesValidationContext): { items: Array<Omit<SalesOrderItemEntity, "id" | "salesOrderId">>; subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint } {
    if (!input.businessId) throw new SalesError("TENANT_REQUIRED", "businessId is required.");
    if (!context.customer || context.customer.businessId !== input.businessId || !context.customer.isActive) throw new SalesError("CUSTOMER_NOT_AVAILABLE", "Customer is not available in this business.");
    if (input.items.length === 0) throw new SalesError("SALES_ITEMS_REQUIRED", "Sale requires at least one item.");
    this.assertRevenue(input.revenueSettlementAccountId, context.revenueSettlementAccount ?? null, input.businessId, "revenueSettlementAccountId");
    if (input.arAccountId) this.assertAsset(input.arAccountId, context.arAccount ?? null, input.businessId, "arAccountId");
    const products = new Map((context.products ?? []).map((p) => [p.id, p]));
    let subtotal = 0n, discountTotal = 0n, taxTotal = 0n;
    const items = input.items.map((line) => {
      if (line.quantity <= 0n) throw new SalesError("INVALID_QUANTITY", "Sale quantity must be greater than zero.");
      const product = products.get(line.productId);
      if (!product || product.businessId !== input.businessId || !product.isActive) throw new SalesError("PRODUCT_NOT_FOUND", "Product was not found in this business.", { productId: line.productId });
      const selectedPrice = this.selectPrice(product.id, line.priceId, context.prices ?? []);
      const unitPrice = line.unitPrice ?? selectedPrice?.amount;
      if (unitPrice === undefined || unitPrice <= 0n) throw new SalesError("PRICE_REQUIRED", "Sale item requires a positive price.", { productId: product.id });
      const gross = line.quantity * unitPrice;
      const discount = line.discountAmount ?? 0n;
      const tax = line.taxAmount ?? 0n;
      if (discount < 0n || tax < 0n || discount > gross) throw new SalesError("INVALID_DISCOUNT_OR_TAX", "Discount and tax amounts are invalid.");
      subtotal += gross; discountTotal += discount; taxTotal += tax;
      return { businessId: input.businessId, productId: product.id, productType: product.type, quantity: line.quantity, unitPrice, discountAmount: discount, taxAmount: tax, lineTotal: gross - discount + tax, locationId: line.locationId ?? null, providerProductId: line.providerProductId ?? null };
    });
    return { items, subtotal, discountTotal, taxTotal, totalAmount: subtotal - discountTotal + taxTotal };
  }

  confirm(order: SalesOrderEntity): void { if (order.status !== "DRAFT") throw new SalesError("ONLY_DRAFT_CAN_BE_CONFIRMED", "Only draft sales can be confirmed."); }
  nextStatus(total: bigint, paid: bigint): SalesStatus { if (paid === 0n) return "CONFIRMED"; if (paid < total) return "PARTIALLY_PAID"; if (paid === total) return "PAID"; throw new SalesError("OVERPAYMENT", "Paid amount cannot exceed sale total."); }
  previewRevenue(order: SalesOrderEntity, revenueAccount: AccountSnapshot, debitAccount: AccountSnapshot): SalesJournalPreview { return this.preview(order.businessId, order.saleDate, "SALES_REVENUE", order.description, [this.line(debitAccount, "DEBIT", order.totalAmount), this.line(revenueAccount, "CREDIT", order.totalAmount)]); }

  private selectPrice(productId: string, priceId: string | undefined, prices: ProductPriceEntity[]): ProductPriceEntity | null {
    const candidates = prices.filter((p) => p.productId === productId && p.priceType === "SELL" && p.isActive);
    if (priceId) return candidates.find((p) => p.id === priceId) ?? null;
    return candidates.sort((a, b) => b.priority - a.priority || b.effectiveDate.getTime() - a.effectiveDate.getTime())[0] ?? null;
  }
  private assertRevenue(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPosting(id, account, businessId, field); if (!account || account.groupCode !== 4) throw new SalesError("ACCOUNT_NOT_REVENUE", "Account must be a revenue account.", { field, accountId: id }); }
  private assertAsset(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPosting(id, account, businessId, field); if (!account || account.groupCode !== 1) throw new SalesError("ACCOUNT_NOT_ASSET", "Account must be an asset account.", { field, accountId: id }); }
  private assertPosting(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { if (!account) throw new SalesError("ACCOUNT_NOT_FOUND", "Account was not found in this business.", { field, accountId: id }); if (account.businessId !== businessId) throw new SalesError("TENANT_ACCOUNT_MISMATCH", "Account must belong to the same business."); if (!account.isActive || !account.isPostingAllowed) throw new SalesError("ACCOUNT_NOT_POSTABLE", "Account must be active and posting-enabled."); }
  private preview(businessId: string, transactionDate: Date, source: string, description: string, lines: SalesJournalPreview["lines"]): SalesJournalPreview { const totalDebit = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0n); const totalCredit = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0n); return { businessId, transactionDate, source, description, lines, totalDebit, totalCredit }; }
  private line(account: AccountSnapshot, side: "DEBIT" | "CREDIT", amount: bigint) { return { accountId: account.id, side, amount, accountCode: account.code, accountName: account.name }; }
}
