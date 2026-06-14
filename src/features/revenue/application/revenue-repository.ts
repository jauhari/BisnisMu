import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreateRevenueCategoryInput, CreateRevenueItemInput, CreateRevenuePackageInput, CreateRevenuePricingInput, RevenueCategory, RevenueDraftInput, RevenueItem, RevenuePackage, RevenuePricing, RevenueTransactionEntity, TenantContext } from "../domain/revenue-types";
import type { TxClient } from "../../shared/tx";

export interface RevenueAuditEvent {
  action: "REVENUE_CATEGORY_CREATED" | "REVENUE_ITEM_CREATED" | "REVENUE_PACKAGE_CREATED" | "REVENUE_PRICING_CREATED" | "REVENUE_TRANSACTION_DRAFTED" | "REVENUE_TRANSACTION_POSTED" | "REVENUE_TRANSACTION_VOIDED";
  businessId: string;
  actorUserId: string;
  entityType: "revenue_category" | "revenue_item" | "revenue_package" | "revenue_pricing" | "revenue_transaction";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface RevenueRepository {
  findAccount(ctx: TenantContext, accountId: string): Promise<AccountSnapshot | null>;
  findCategory(ctx: TenantContext, categoryId: string): Promise<RevenueCategory | null>;
  findItem(ctx: TenantContext, itemId: string): Promise<RevenueItem | null>;
  findPackage(ctx: TenantContext, packageId: string): Promise<RevenuePackage | null>;
  findPricing(ctx: TenantContext, pricingId: string): Promise<RevenuePricing | null>;
  listPricings(ctx: TenantContext, input: { itemId?: string; packageId?: string }): Promise<RevenuePricing[]>;
  createCategory(ctx: TenantContext, input: CreateRevenueCategoryInput): Promise<RevenueCategory>;
  createItem(ctx: TenantContext, input: CreateRevenueItemInput): Promise<RevenueItem>;
  createPackage(ctx: TenantContext, input: CreateRevenuePackageInput): Promise<RevenuePackage>;
  createPricing(ctx: TenantContext, input: CreateRevenuePricingInput): Promise<RevenuePricing>;
  nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string>;
  createDraft(ctx: TenantContext, input: RevenueDraftInput & { unitPrice: bigint; amount: bigint; pricingId?: string | null }, transactionNumber: string): Promise<RevenueTransactionEntity>;
  findTransaction(ctx: TenantContext, transactionId: string): Promise<RevenueTransactionEntity | null>;
  markPosted(ctx: TenantContext, transactionId: string, journalId: string, tx?: TxClient): Promise<RevenueTransactionEntity>;
  markVoided(ctx: TenantContext, transactionId: string, journalId: string, reason: string, tx?: TxClient): Promise<RevenueTransactionEntity>;
  createAuditLog(ctx: TenantContext, event: RevenueAuditEvent): Promise<void>;
}

export interface RevenueCommandMeta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreateRevenueCategoryCommand extends CreateRevenueCategoryInput, RevenueCommandMeta {}
export interface CreateRevenueItemCommand extends CreateRevenueItemInput, RevenueCommandMeta {}
export interface CreateRevenuePackageCommand extends CreateRevenuePackageInput, RevenueCommandMeta {}
export interface CreateRevenuePricingCommand extends CreateRevenuePricingInput, RevenueCommandMeta {}
export interface CreateRevenueDraftCommand extends RevenueDraftInput, RevenueCommandMeta {}
export interface PostRevenueCommand { businessId: string; transactionId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface VoidRevenueCommand { businessId: string; transactionId: string; reason: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }

