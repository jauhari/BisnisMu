import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreateProductInput, InventoryBalanceEntity, InventoryMovementEntity, ProductCategoryEntity, ProductCostHistoryEntity, ProductEntity, ProductPriceEntity, ProviderProductEntity, TenantContext, UpdatePriceInput, UpdateProductInput } from "../domain/inventory-types";

export interface InventoryAuditEvent { action: "PRODUCT_CREATED" | "PRODUCT_UPDATED" | "PRODUCT_PRICE_UPDATED" | "INVENTORY_STOCK_IN" | "INVENTORY_STOCK_OUT" | "INVENTORY_ADJUSTED" | "INVENTORY_TRANSFERRED" | "DIGITAL_PRODUCT_CONSUMED"; businessId: string; actorUserId: string; entityType: "product" | "product_price" | "inventory_movement" | "provider_product"; entityId?: string; metadata: Record<string, unknown>; }

export interface CreateInventoryMovementRecord extends Omit<InventoryMovementEntity, "id"> {}
export interface CreateCostHistoryRecord { businessId: string; productId: string; previousCost?: bigint; buyPrice: bigint; sellPrice?: bigint | null; marginAmount?: bigint | null; marginRateBps?: bigint | null; effectiveDate: Date; source: "PRICE_UPDATE" | "STOCK_IN" | "DIGITAL_PROVIDER"; }

export interface InventoryRepository {
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  findCategory(ctx: TenantContext, categoryId: string): Promise<ProductCategoryEntity | null>;
  createProduct(ctx: TenantContext, input: CreateProductInput): Promise<ProductEntity>;
  updateProduct(ctx: TenantContext, productId: string, input: UpdateProductInput): Promise<ProductEntity>;
  findProduct(ctx: TenantContext, productId: string): Promise<ProductEntity | null>;
  listProducts(ctx: TenantContext): Promise<ProductEntity[]>;
  listCategories(ctx: TenantContext): Promise<ProductCategoryEntity[]>;
  createProviderProduct(ctx: TenantContext, input: { productId: string; provider: string; providerSku: string; floatAccountId: string; dynamicBuyPrice?: bigint; dynamicSellPrice?: bigint }): Promise<ProviderProductEntity>;
  findProviderProduct(ctx: TenantContext, productId: string, providerProductId?: string): Promise<ProviderProductEntity | null>;
  createPrice(ctx: TenantContext, input: UpdatePriceInput): Promise<ProductPriceEntity>;
  findActivePrice(ctx: TenantContext, productId: string, priceType: "BUY" | "SELL", asOf: Date): Promise<ProductPriceEntity | null>;
  listPrices(ctx: TenantContext, productId: string): Promise<ProductPriceEntity[]>;
  createCostHistory(ctx: TenantContext, input: CreateCostHistoryRecord): Promise<ProductCostHistoryEntity>;
  listCostHistory(ctx: TenantContext, productId: string): Promise<ProductCostHistoryEntity[]>;
  findBalance(ctx: TenantContext, productId: string, locationId: string): Promise<InventoryBalanceEntity | null>;
  listBalances(ctx: TenantContext): Promise<InventoryBalanceEntity[]>;
  listMovements(ctx: TenantContext, type?: InventoryMovementEntity["type"]): Promise<InventoryMovementEntity[]>;
  upsertBalance(ctx: TenantContext, balance: InventoryBalanceEntity): Promise<InventoryBalanceEntity>;
  atomicStockIn(ctx: TenantContext, productId: string, locationId: string, quantity: bigint, unitCost: bigint): Promise<InventoryBalanceEntity>;
  atomicStockOut(ctx: TenantContext, productId: string, locationId: string, quantity: bigint): Promise<InventoryBalanceEntity>;
  createMovement(ctx: TenantContext, movement: CreateInventoryMovementRecord): Promise<InventoryMovementEntity>;
  createAuditLog(ctx: TenantContext, event: InventoryAuditEvent): Promise<void>;
}

export interface Meta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreateProductCommand extends CreateProductInput, Meta {}
export interface UpdateProductCommand extends UpdateProductInput, Meta {}
export interface UpdatePriceCommand extends UpdatePriceInput, Meta {}
export interface StockInCommand { businessId: string; productId: string; locationId: string; movementDate: Date; quantity: bigint; unitCost: bigint; description: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface StockOutCommand { businessId: string; productId: string; locationId: string; movementDate: Date; quantity: bigint; description: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface AdjustStockCommand { businessId: string; productId: string; locationId: string; movementDate: Date; newQuantity: bigint; unitCost?: bigint; description: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface TransferStockCommand { businessId: string; productId: string; fromLocationId: string; toLocationId: string; movementDate: Date; quantity: bigint; description: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface ConsumeDigitalProductCommand { businessId: string; productId: string; providerProductId?: string; transactionDate: Date; quantity: bigint; description: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface GetInventoryBalanceCommand { businessId: string; productId: string; locationId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
