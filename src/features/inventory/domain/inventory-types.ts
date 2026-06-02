import { AccountSnapshot, JournalLineInput } from "../../accounting/domain/accounting-types";

export type ProductType = "PHYSICAL" | "DIGITAL" | "SERVICE";
export type InventoryMovementType = "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "TRANSFER" | "DIGITAL_CONSUMPTION";
export type ProviderCode = "FASTPAY" | "PAYFAZZ" | "BUKUWARUNG" | "SHOPEEPAY" | "LINKAJA" | "CUSTOM";

export interface TenantContext { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }

export interface ProductCategoryEntity { id: string; businessId: string; name: string; parentId?: string | null; isActive: boolean; }
export interface ProductEntity { id: string; businessId: string; type: ProductType; sku: string; barcode?: string | null; name: string; description?: string | null; categoryId?: string | null; inventoryAccountId?: string | null; cogsAccountId?: string | null; revenueAccountId: string; trackStock: boolean; isActive: boolean; }
export interface ProductPriceEntity { id: string; businessId: string; productId: string; priceType: "BUY" | "SELL"; amount: bigint; effectiveDate: Date; priority: number; isActive: boolean; }
export interface InventoryBalanceEntity { id: string; businessId: string; productId: string; locationId: string; quantity: bigint; averageCost: bigint; inventoryValue: bigint; }
export interface InventoryMovementEntity { id: string; businessId: string; productId: string; type: InventoryMovementType; movementDate: Date; quantity: bigint; unitCost: bigint; totalCost: bigint; fromLocationId?: string | null; toLocationId?: string | null; balanceAfter: bigint; averageCostAfter: bigint; postedJournalId?: string | null; description: string; }
export interface ProviderProductEntity { id: string; businessId: string; productId: string; provider: ProviderCode; providerSku: string; floatAccountId: string; dynamicBuyPrice?: bigint | null; dynamicSellPrice?: bigint | null; isActive: boolean; }
export interface ProductCostHistoryEntity { id: string; businessId: string; productId: string; previousCost: bigint; buyPrice: bigint; sellPrice?: bigint | null; marginAmount?: bigint | null; marginRateBps?: bigint | null; effectiveDate: Date; source: "PRICE_UPDATE" | "STOCK_IN" | "DIGITAL_PROVIDER"; }

export interface CreateProductInput { businessId: string; type: ProductType; sku: string; barcode?: string; name: string; description?: string; categoryId?: string; inventoryAccountId?: string; cogsAccountId?: string; revenueAccountId: string; trackStock?: boolean; provider?: ProviderCode; providerSku?: string; floatAccountId?: string; buyPrice?: bigint; sellPrice?: bigint; }
export interface UpdateProductInput { businessId: string; productId: string; type: ProductType; sku: string; barcode?: string | null; name: string; description?: string | null; categoryId?: string | null; inventoryAccountId?: string | null; cogsAccountId?: string | null; revenueAccountId: string; trackStock?: boolean; }
export interface UpdatePriceInput { businessId: string; productId: string; priceType: "BUY" | "SELL"; amount: bigint; effectiveDate: Date; priority?: number; }
export interface StockInInput { businessId: string; productId: string; locationId: string; movementDate: Date; quantity: bigint; unitCost: bigint; description: string; }
export interface StockOutInput { businessId: string; productId: string; locationId: string; movementDate: Date; quantity: bigint; description: string; }
export interface AdjustStockInput { businessId: string; productId: string; locationId: string; movementDate: Date; newQuantity: bigint; unitCost?: bigint; description: string; }
export interface TransferStockInput { businessId: string; productId: string; fromLocationId: string; toLocationId: string; movementDate: Date; quantity: bigint; description: string; }
export interface ConsumeDigitalProductInput { businessId: string; productId: string; providerProductId?: string; transactionDate: Date; quantity: bigint; description: string; }

export interface JournalPreviewLine extends JournalLineInput { accountCode: string; accountName: string; }
export interface InventoryJournalPreview { businessId: string; transactionDate: Date; source: string; description: string; lines: JournalPreviewLine[]; totalDebit: bigint; totalCredit: bigint; }

export interface InventoryValidationContext { product?: ProductEntity | null; category?: ProductCategoryEntity | null; balance?: InventoryBalanceEntity | null; providerProduct?: ProviderProductEntity | null; inventoryAccount?: AccountSnapshot | null; cogsAccount?: AccountSnapshot | null; revenueAccount?: AccountSnapshot | null; }

export class InventoryError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "InventoryError";
  }
}
