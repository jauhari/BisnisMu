import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";

export type RevenueType = "TICKET" | "PACKAGE" | "PARKING" | "RENTAL" | "TENANT_RENT" | "SERVICE" | "PRODUCT_SALE" | "OTHER_REVENUE";
export type RevenueTransactionStatus = "DRAFT" | "POSTED" | "VOID";
export type RevenuePricingType = "STANDARD" | "TIER" | "DAILY" | "WEEKEND" | "SEASONAL" | "PACKAGE";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }

export interface RevenueCategory { id: string; businessId: string; name: string; type: RevenueType; revenueAccountId: string; description?: string | null; isActive: boolean; }
export interface RevenueItem { id: string; businessId: string; categoryId: string; name: string; sku?: string | null; description?: string | null; isActive: boolean; }
export interface RevenuePackage { id: string; businessId: string; categoryId: string; name: string; description?: string | null; isActive: boolean; }
export interface RevenuePricing { id: string; businessId: string; itemId?: string | null; packageId?: string | null; type: RevenuePricingType; tierName?: string | null; amount: bigint; startsOn?: Date | null; endsOn?: Date | null; dayOfWeek?: number | null; minQuantity?: number | null; maxQuantity?: number | null; isActive: boolean; }

export interface RevenueTransactionEntity {
  id: string;
  businessId: string;
  transactionNumber: string;
  status: RevenueTransactionStatus;
  type: RevenueType;
  transactionDate: Date;
  categoryId: string;
  itemId?: string | null;
  packageId?: string | null;
  pricingId?: string | null;
  cashAccountId: string;
  quantity: number;
  unitPrice: bigint;
  amount: bigint;
  description: string;
  contactId?: string | null;
  postedJournalId?: string | null;
  voidJournalId?: string | null;
  voidReason?: string | null;
  createdByUserId: string;
}

export interface CreateRevenueCategoryInput { businessId: string; name: string; type: RevenueType; revenueAccountId: string; description?: string; }
export interface CreateRevenueItemInput { businessId: string; categoryId: string; name: string; sku?: string; description?: string; }
export interface CreateRevenuePackageInput { businessId: string; categoryId: string; name: string; description?: string; }
export interface CreateRevenuePricingInput { businessId: string; itemId?: string; packageId?: string; type: RevenuePricingType; tierName?: string; amount: bigint; startsOn?: Date; endsOn?: Date; dayOfWeek?: number; minQuantity?: number; maxQuantity?: number; }

export interface RevenueDraftInput {
  businessId: string;
  type: RevenueType;
  transactionDate: Date;
  categoryId: string;
  itemId?: string;
  packageId?: string;
  pricingId?: string;
  cashAccountId: string;
  quantity: number;
  unitPrice?: bigint;
  description: string;
  contactId?: string;
}

export interface RevenueValidationContext {
  category: RevenueCategory | null;
  item?: RevenueItem | null;
  package?: RevenuePackage | null;
  pricing?: RevenuePricing | null;
  availablePricings: RevenuePricing[];
  cashAccount: AccountSnapshot | null;
  revenueAccount: AccountSnapshot | null;
}

export interface RevenueJournalPreview { businessId: string; transactionDate: Date; description: string; lines: JournalLineInput[]; amount: bigint; unitPrice: bigint; pricingId?: string | null; }

export class RevenueError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) { super(message); this.name = "RevenueError"; }
}

