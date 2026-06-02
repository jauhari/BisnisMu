import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { RevenueDraftInput, RevenueError, RevenueJournalPreview, RevenuePricing, RevenueTransactionEntity, RevenueValidationContext } from "./revenue-types";

export class RevenueEngine {
  validateCategoryAccount(account: AccountSnapshot | null, businessId: string): void {
    if (!account) throw new RevenueError("REVENUE_ACCOUNT_NOT_FOUND", "Revenue account was not found.");
    if (account.businessId !== businessId) throw new RevenueError("TENANT_ACCOUNT_MISMATCH", "Revenue account must belong to the same business.");
    if (!account.isActive || !account.isPostingAllowed || account.groupCode !== 4) throw new RevenueError("INVALID_REVENUE_ACCOUNT", "Revenue category must use an active posting revenue account.", { accountId: account.id });
  }

  preview(input: RevenueDraftInput, context: RevenueValidationContext): RevenueJournalPreview {
    this.validateDraft(input, context);
    const pricing = context.pricing ?? this.selectPricing(input, context.availablePricings);
    const unitPrice = input.unitPrice ?? pricing?.amount;
    if (unitPrice === undefined) throw new RevenueError("PRICE_REQUIRED", "Revenue transaction requires unitPrice or matching pricing.");
    if (unitPrice <= 0n) throw new RevenueError("INVALID_PRICE", "Revenue price must be greater than zero.");
    const amount = unitPrice * BigInt(input.quantity);
    const preview: RevenueJournalPreview = { businessId: input.businessId, transactionDate: input.transactionDate, description: input.description, amount, unitPrice, lines: [{ accountId: input.cashAccountId, side: "DEBIT", amount }, { accountId: context.category!.revenueAccountId, side: "CREDIT", amount }] };
    const pricingId = pricing?.id ?? input.pricingId;
    if (pricingId !== undefined && pricingId !== null) preview.pricingId = pricingId;
    return preview;
  }

  previewVoid(tx: RevenueTransactionEntity): RevenueJournalPreview {
    if (tx.status !== "POSTED") throw new RevenueError("ONLY_POSTED_CAN_BE_VOIDED", "Only posted revenue transactions can be voided.");
    const preview: RevenueJournalPreview = { businessId: tx.businessId, transactionDate: tx.transactionDate, description: "Void: " + tx.description, amount: tx.amount, unitPrice: tx.unitPrice, lines: [{ accountId: tx.cashAccountId, side: "CREDIT", amount: tx.amount }, { accountId: "__REVENUE_ACCOUNT__", side: "DEBIT", amount: tx.amount }] };
    if (tx.pricingId !== undefined && tx.pricingId !== null) preview.pricingId = tx.pricingId;
    return preview;
  }

  buildVoidLines(tx: RevenueTransactionEntity, revenueAccountId: string) {
    if (tx.status !== "POSTED") throw new RevenueError("ONLY_POSTED_CAN_BE_VOIDED", "Only posted revenue transactions can be voided.");
    return [{ accountId: tx.cashAccountId, side: "CREDIT" as const, amount: tx.amount }, { accountId: revenueAccountId, side: "DEBIT" as const, amount: tx.amount }];
  }

  private validateDraft(input: RevenueDraftInput, context: RevenueValidationContext): void {
    if (!input.businessId) throw new RevenueError("TENANT_REQUIRED", "businessId is required.");
    if (!input.description.trim()) throw new RevenueError("DESCRIPTION_REQUIRED", "Description is required.");
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new RevenueError("INVALID_QUANTITY", "Quantity must be a positive integer.");
    if (!context.category || context.category.businessId !== input.businessId || !context.category.isActive) throw new RevenueError("CATEGORY_NOT_AVAILABLE", "Revenue category must be active and belong to the same business.");
    if (context.category.type !== input.type) throw new RevenueError("REVENUE_TYPE_MISMATCH", "Revenue transaction type must match category type.");
    this.assertCashAccount(context.cashAccount, input.businessId);
    this.assertRevenueAccount(context.revenueAccount, input.businessId);
    if (input.itemId && (!context.item || context.item.businessId !== input.businessId || context.item.categoryId !== input.categoryId || !context.item.isActive)) throw new RevenueError("ITEM_NOT_AVAILABLE", "Revenue item is not available for this category.");
    if (input.packageId && (!context.package || context.package.businessId !== input.businessId || context.package.categoryId !== input.categoryId || !context.package.isActive)) throw new RevenueError("PACKAGE_NOT_AVAILABLE", "Revenue package is not available for this category.");
    if (!input.itemId && !input.packageId && input.unitPrice === undefined) throw new RevenueError("REVENUE_TARGET_REQUIRED", "Revenue transaction requires an item, package, or explicit unit price.");
  }

  private selectPricing(input: RevenueDraftInput, pricings: RevenuePricing[]): RevenuePricing | null {
    const candidates = pricings.filter((pricing) => pricing.isActive && (!pricing.itemId || pricing.itemId === input.itemId) && (!pricing.packageId || pricing.packageId === input.packageId) && this.matchesDate(pricing, input.transactionDate) && this.matchesQuantity(pricing, input.quantity));
    const priority = { SEASONAL: 6, WEEKEND: 5, DAILY: 4, TIER: 3, PACKAGE: 2, STANDARD: 1 } as const;
    return candidates.sort((a, b) => priority[b.type] - priority[a.type] || Number(b.amount - a.amount))[0] ?? null;
  }

  private matchesDate(pricing: RevenuePricing, date: Date): boolean {
    if (pricing.startsOn && date < pricing.startsOn) return false;
    if (pricing.endsOn && date > pricing.endsOn) return false;
    if (pricing.type === "WEEKEND") return [0, 6].includes(date.getUTCDay());
    if (pricing.type === "DAILY" && pricing.dayOfWeek !== null && pricing.dayOfWeek !== undefined) return date.getUTCDay() === pricing.dayOfWeek;
    return true;
  }

  private matchesQuantity(pricing: RevenuePricing, quantity: number): boolean {
    if (pricing.minQuantity !== null && pricing.minQuantity !== undefined && quantity < pricing.minQuantity) return false;
    if (pricing.maxQuantity !== null && pricing.maxQuantity !== undefined && quantity > pricing.maxQuantity) return false;
    return true;
  }

  private assertCashAccount(account: AccountSnapshot | null, businessId: string): void {
    if (!account) throw new RevenueError("CASH_ACCOUNT_NOT_FOUND", "Cash account was not found.");
    if (account.businessId !== businessId) throw new RevenueError("TENANT_ACCOUNT_MISMATCH", "Cash account must belong to the same business.");
    if (!account.isActive || !account.isPostingAllowed || account.groupCode !== 1 || (account.subtype !== "cash" && account.subtype !== "bank")) throw new RevenueError("INVALID_CASH_ACCOUNT", "Revenue must debit an active cash or bank account.");
  }

  private assertRevenueAccount(account: AccountSnapshot | null, businessId: string): void {
    if (!account) throw new RevenueError("REVENUE_ACCOUNT_NOT_FOUND", "Revenue account was not found.");
    if (account.businessId !== businessId) throw new RevenueError("TENANT_ACCOUNT_MISMATCH", "Revenue account must belong to the same business.");
    if (!account.isActive || !account.isPostingAllowed || account.groupCode !== 4) throw new RevenueError("INVALID_REVENUE_ACCOUNT", "Revenue must credit an active revenue account.");
  }
}

