import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { CreateCostHistoryRecord, CreateInventoryMovementRecord, InventoryAuditEvent, InventoryRepository } from "../application/inventory-repository";
import { CreateProductInput, InventoryBalanceEntity, InventoryMovementEntity, ProductCategoryEntity, ProductCostHistoryEntity, ProductEntity, ProductPriceEntity, ProviderProductEntity, TenantContext, UpdatePriceInput, UpdateProductInput } from "../domain/inventory-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    const rows = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return rows.map((account) => ({ id: account.id, businessId: account.businessId, code: account.code, name: account.name, groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode, normalBalance: account.normalBalance, subtype: account.subtype, isPostingAllowed: account.isPostingAllowed, isActive: account.isActive }));
  }

  async findCategory(ctx: TenantContext, categoryId: string): Promise<ProductCategoryEntity | null> {
    const row = await this.prisma.productCategory.findFirst({ where: { businessId: ctx.businessId, id: categoryId } });
    return row ? this.toCategory(row) : null;
  }

  async createProduct(ctx: TenantContext, input: CreateProductInput): Promise<ProductEntity> {
    const row = await this.prisma.product.create({ data: { businessId: ctx.businessId, categoryId: input.categoryId ?? null, sku: input.sku.trim(), barcode: input.barcode ?? null, name: input.name.trim(), description: input.description ?? null, type: input.type, inventoryAccountId: input.inventoryAccountId ?? null, cogsAccountId: input.cogsAccountId ?? null, revenueAccountId: input.revenueAccountId, trackStock: input.trackStock ?? input.type === "PHYSICAL" } });
    return this.toProduct(row);
  }

  async updateProduct(ctx: TenantContext, productId: string, input: UpdateProductInput): Promise<ProductEntity> {
    const row = await this.prisma.product.update({ where: { id: productId, businessId: ctx.businessId }, data: { categoryId: input.categoryId ?? null, sku: input.sku.trim(), barcode: input.barcode ?? null, name: input.name.trim(), description: input.description ?? null, type: input.type, inventoryAccountId: input.inventoryAccountId ?? null, cogsAccountId: input.cogsAccountId ?? null, revenueAccountId: input.revenueAccountId, trackStock: input.trackStock ?? input.type === "PHYSICAL" } });
    return this.toProduct(row);
  }

  async findProduct(ctx: TenantContext, productId: string): Promise<ProductEntity | null> {
    const row = await this.prisma.product.findFirst({ where: { businessId: ctx.businessId, id: productId } });
    return row ? this.toProduct(row) : null;
  }

  async listProducts(ctx: TenantContext): Promise<ProductEntity[]> {
    const [rows, sellPrices, buyPrices, providerProducts] = await Promise.all([
      this.prisma.product.findMany({ where: { businessId: ctx.businessId }, orderBy: { name: "asc" } }),
      this.prisma.productPrice.findMany({ where: { businessId: ctx.businessId, priceType: "SELL", isActive: true }, orderBy: [{ priority: "desc" }, { effectiveDate: "desc" }, { createdAt: "desc" }] }),
      this.prisma.productPrice.findMany({ where: { businessId: ctx.businessId, priceType: "BUY", isActive: true }, orderBy: [{ priority: "desc" }, { effectiveDate: "desc" }, { createdAt: "desc" }] }),
      this.prisma.providerProduct.findMany({ where: { businessId: ctx.businessId } }),
    ]);
    const sellByProduct = new Map<string, bigint>();
    const buyByProduct = new Map<string, bigint>();
    const providerByProduct = new Map<string, { providerBuyPrice: bigint | null; providerSellPrice: bigint | null; provider: string; providerCode: string }>();
    for (const price of sellPrices) if (!sellByProduct.has(price.productId)) sellByProduct.set(price.productId, price.amount);
    for (const price of buyPrices) if (!buyByProduct.has(price.productId)) buyByProduct.set(price.productId, price.amount);
    for (const pp of providerProducts) providerByProduct.set(pp.productId, { providerBuyPrice: pp.providerBuyPrice, providerSellPrice: pp.providerSellPrice, provider: pp.provider, providerCode: pp.providerCode });
    return rows.map((row) => {
      const provider = providerByProduct.get(row.id);
      const buyPrice = buyByProduct.get(row.id) ?? provider?.providerBuyPrice ?? null;
      return { ...this.toProduct(row), sellPrice: sellByProduct.get(row.id) ?? provider?.providerSellPrice ?? null, buyPrice, providerCode: provider?.providerCode ?? null, provider: provider?.provider ?? null };
    });
  }

  async listCategories(ctx: TenantContext): Promise<ProductCategoryEntity[]> {
    const rows = await this.prisma.productCategory.findMany({ where: { businessId: ctx.businessId }, orderBy: { name: "asc" } });
    return rows.map((row) => this.toCategory(row));
  }

  async createProviderProduct(ctx: TenantContext, input: { productId: string; provider: string; providerSku: string; floatAccountId: string; dynamicBuyPrice?: bigint; dynamicSellPrice?: bigint }): Promise<ProviderProductEntity> {
    const row = await this.prisma.providerProduct.create({ data: { businessId: ctx.businessId, productId: input.productId, provider: input.provider as Prisma.ProviderProductCreateInput["provider"], providerCode: input.providerSku, floatAccountId: input.floatAccountId, providerBuyPrice: input.dynamicBuyPrice ?? null, providerSellPrice: input.dynamicSellPrice ?? null } });
    return this.toProviderProduct(row);
  }

  async findProviderProduct(ctx: TenantContext, productId: string, providerProductId?: string): Promise<ProviderProductEntity | null> {
    const row = await this.prisma.providerProduct.findFirst({ where: { businessId: ctx.businessId, productId, ...(providerProductId ? { id: providerProductId } : {}) }, orderBy: { createdAt: "desc" } });
    return row ? this.toProviderProduct(row) : null;
  }

  async createPrice(ctx: TenantContext, input: UpdatePriceInput): Promise<ProductPriceEntity> {
    const row = await this.prisma.productPrice.create({ data: { businessId: ctx.businessId, productId: input.productId, priceType: input.priceType, amount: input.amount, effectiveDate: input.effectiveDate, priority: input.priority ?? 0 } });
    return this.toPrice(row);
  }

  async findActivePrice(ctx: TenantContext, productId: string, priceType: "BUY" | "SELL", asOf: Date): Promise<ProductPriceEntity | null> {
    const row = await this.prisma.productPrice.findFirst({ where: { businessId: ctx.businessId, productId, priceType, isActive: true, effectiveDate: { lte: asOf } }, orderBy: [{ priority: "desc" }, { effectiveDate: "desc" }, { createdAt: "desc" }] });
    return row ? this.toPrice(row) : null;
  }

  async listPrices(ctx: TenantContext, productId: string): Promise<ProductPriceEntity[]> {
    const rows = await this.prisma.productPrice.findMany({ where: { businessId: ctx.businessId, productId }, orderBy: [{ priceType: "asc" }, { priority: "desc" }, { effectiveDate: "desc" }] });
    return rows.map((row) => this.toPrice(row));
  }

  async createCostHistory(ctx: TenantContext, input: CreateCostHistoryRecord): Promise<ProductCostHistoryEntity> {
    const row = await this.prisma.productCostHistory.create({ data: { businessId: ctx.businessId, productId: input.productId, previousCost: input.previousCost ?? 0n, newCost: input.buyPrice, sellPrice: input.sellPrice ?? null, marginAmount: input.marginAmount ?? null, marginRateBps: input.marginRateBps ?? null, effectiveDate: input.effectiveDate, source: input.source } });
    return this.toCostHistory(row);
  }

  async listCostHistory(ctx: TenantContext, productId: string): Promise<ProductCostHistoryEntity[]> {
    const rows = await this.prisma.productCostHistory.findMany({ where: { businessId: ctx.businessId, productId }, orderBy: { effectiveDate: "desc" } });
    return rows.map((row) => this.toCostHistory(row));
  }

  async findBalance(ctx: TenantContext, productId: string, locationId: string): Promise<InventoryBalanceEntity | null> {
    const row = await this.prisma.inventoryBalance.findUnique({ where: { businessId_productId_warehouseId: { businessId: ctx.businessId, productId, warehouseId: locationId } } });
    return row ? this.toBalance(row) : null;
  }

  async listBalances(ctx: TenantContext): Promise<InventoryBalanceEntity[]> {
    const rows = await this.prisma.inventoryBalance.findMany({ where: { businessId: ctx.businessId }, orderBy: [{ warehouseId: "asc" }, { productId: "asc" }] });
    return rows.map((row) => this.toBalance(row));
  }

  async listMovements(ctx: TenantContext, type?: InventoryMovementEntity["type"]): Promise<InventoryMovementEntity[]> {
    const rows = await this.prisma.inventoryMovement.findMany({ where: { businessId: ctx.businessId, ...(type ? { type: type === "STOCK_IN" ? "STOCK_IN" : type === "STOCK_OUT" ? "STOCK_OUT" : type } : {}) }, orderBy: { movementDate: "desc" } });
    return rows.map((row) => this.toMovement(row));
  }

  async upsertBalance(ctx: TenantContext, balance: InventoryBalanceEntity): Promise<InventoryBalanceEntity> {
    const row = await this.prisma.inventoryBalance.upsert({ where: { businessId_productId_warehouseId: { businessId: ctx.businessId, productId: balance.productId, warehouseId: balance.locationId } }, update: { quantity: balance.quantity, averageCost: balance.averageCost, inventoryValue: balance.inventoryValue }, create: { businessId: ctx.businessId, productId: balance.productId, warehouseId: balance.locationId, quantity: balance.quantity, averageCost: balance.averageCost, inventoryValue: balance.inventoryValue } });
    return this.toBalance(row);
  }

  async atomicStockIn(ctx: TenantContext, productId: string, locationId: string, quantity: bigint, unitCost: bigint): Promise<InventoryBalanceEntity> {
    const incomingValue = quantity * unitCost;
    const now = new Date();
    const id = this.cuid();
    const result = await this.prisma.$queryRaw<Array<{ id: string; business_id: string; product_id: string; warehouse_id: string; quantity: bigint; average_cost: bigint; inventory_value: bigint }>>`
      INSERT INTO inventory_balances (id, business_id, product_id, warehouse_id, quantity, average_cost, inventory_value, updated_at)
      VALUES (${id}, ${ctx.businessId}, ${productId}, ${locationId}, ${quantity}, ${unitCost}, ${incomingValue}, ${now})
      ON CONFLICT (business_id, product_id, warehouse_id)
      DO UPDATE SET
        quantity = inventory_balances.quantity + ${quantity},
        inventory_value = inventory_balances.inventory_value + ${incomingValue},
        average_cost = CASE
          WHEN (inventory_balances.quantity + ${quantity}) = 0 THEN 0
          ELSE (inventory_balances.inventory_value + ${incomingValue}) / (inventory_balances.quantity + ${quantity})
        END,
        updated_at = ${now}
      RETURNING id, business_id, product_id, warehouse_id, quantity, average_cost, inventory_value
    `;
    const row = result[0]!;
    return { id: row.id, businessId: row.business_id, productId: row.product_id, locationId: row.warehouse_id, quantity: row.quantity, averageCost: row.average_cost, inventoryValue: row.inventory_value };
  }

  async atomicStockOut(ctx: TenantContext, productId: string, locationId: string, quantity: bigint): Promise<InventoryBalanceEntity> {
    const now = new Date();
    const result = await this.prisma.$queryRaw<Array<{ id: string; business_id: string; product_id: string; warehouse_id: string; quantity: bigint; average_cost: bigint; inventory_value: bigint }>>`
      UPDATE inventory_balances
      SET
        quantity = quantity - ${quantity},
        inventory_value = CASE
          WHEN (quantity - ${quantity}) <= 0 THEN 0
          ELSE inventory_value - (${quantity} * average_cost)
        END,
        average_cost = CASE
          WHEN (quantity - ${quantity}) <= 0 THEN 0
          ELSE average_cost
        END,
        updated_at = ${now}
      WHERE business_id = ${ctx.businessId} AND product_id = ${productId} AND warehouse_id = ${locationId}
      RETURNING id, business_id, product_id, warehouse_id, quantity, average_cost, inventory_value
    `;
    if (result.length === 0) throw new Error("Inventory balance not found for stock out.");
    const row = result[0]!;
    return { id: row.id, businessId: row.business_id, productId: row.product_id, locationId: row.warehouse_id, quantity: row.quantity, averageCost: row.average_cost, inventoryValue: row.inventory_value };
  }

  private cuid(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return "c" + ts + rand;
  }

  async createMovement(ctx: TenantContext, movement: CreateInventoryMovementRecord): Promise<InventoryMovementEntity> {
    const row = await this.prisma.inventoryMovement.create({ data: { businessId: ctx.businessId, productId: movement.productId, type: movement.type === "STOCK_IN" ? "STOCK_IN" : movement.type === "STOCK_OUT" ? "STOCK_OUT" : movement.type, movementDate: movement.movementDate, quantity: movement.quantity, unitCost: movement.unitCost, totalCost: movement.totalCost, fromWarehouseId: movement.fromLocationId ?? null, toWarehouseId: movement.toLocationId ?? null, balanceAfter: movement.balanceAfter, averageCostAfter: movement.averageCostAfter, postedJournalId: movement.postedJournalId ?? null, description: movement.description, createdByUserId: ctx.actorUserId } });
    return this.toMovement(row);
  }

  async createAuditLog(ctx: TenantContext, event: InventoryAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action, entityType: event.entityType, entityId: event.entityId ?? null, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  private toCategory(row: NonNullable<Awaited<ReturnType<PrismaClient["productCategory"]["findFirst"]>>>): ProductCategoryEntity { return { id: row.id, businessId: row.businessId, name: row.name, parentId: row.parentId, isActive: row.isActive }; }
  private toProduct(row: NonNullable<Awaited<ReturnType<PrismaClient["product"]["findFirst"]>>>): ProductEntity { return { id: row.id, businessId: row.businessId, type: row.type, sku: row.sku, barcode: row.barcode, name: row.name, description: row.description, categoryId: row.categoryId, inventoryAccountId: row.inventoryAccountId, cogsAccountId: row.cogsAccountId, revenueAccountId: row.revenueAccountId, trackStock: row.trackStock, isActive: row.isActive }; }
  private toPrice(row: NonNullable<Awaited<ReturnType<PrismaClient["productPrice"]["findFirst"]>>>): ProductPriceEntity { return { id: row.id, businessId: row.businessId, productId: row.productId, priceType: row.priceType, amount: row.amount, effectiveDate: row.effectiveDate, priority: row.priority, isActive: row.isActive }; }
  private toBalance(row: NonNullable<Awaited<ReturnType<PrismaClient["inventoryBalance"]["findFirst"]>>>): InventoryBalanceEntity { return { id: row.id, businessId: row.businessId, productId: row.productId, locationId: row.warehouseId, quantity: row.quantity, averageCost: row.averageCost, inventoryValue: row.inventoryValue }; }
  private toMovement(row: NonNullable<Awaited<ReturnType<PrismaClient["inventoryMovement"]["findFirst"]>>>): InventoryMovementEntity { return { id: row.id, businessId: row.businessId, productId: row.productId, type: row.type === "PURCHASE" ? "STOCK_IN" : row.type === "SALE" ? "STOCK_OUT" : row.type, movementDate: row.movementDate, quantity: row.quantity, unitCost: row.unitCost, totalCost: row.totalCost, fromLocationId: row.fromWarehouseId, toLocationId: row.toWarehouseId, balanceAfter: row.balanceAfter, averageCostAfter: row.averageCostAfter, postedJournalId: row.postedJournalId, description: row.description }; }
  private toProviderProduct(row: NonNullable<Awaited<ReturnType<PrismaClient["providerProduct"]["findFirst"]>>>): ProviderProductEntity { return { id: row.id, businessId: row.businessId, productId: row.productId, provider: row.provider, providerSku: row.providerCode, floatAccountId: row.floatAccountId, dynamicBuyPrice: row.providerBuyPrice, dynamicSellPrice: row.providerSellPrice, isActive: row.isActive }; }
  private toCostHistory(row: NonNullable<Awaited<ReturnType<PrismaClient["productCostHistory"]["findFirst"]>>>): ProductCostHistoryEntity { return { id: row.id, businessId: row.businessId, productId: row.productId, previousCost: row.previousCost, buyPrice: row.newCost, sellPrice: row.sellPrice, marginAmount: row.marginAmount, marginRateBps: row.marginRateBps, effectiveDate: row.effectiveDate, source: row.source }; }
}
