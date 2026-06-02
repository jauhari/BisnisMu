import { PostJournalCommand } from "../../accounting/application/journal-repository";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { FloatManagementService } from "../../float/application/float-service";
import { InventoryEngine } from "../domain/inventory-engine";
import { InventoryBalanceEntity, InventoryError, InventoryValidationContext, TenantContext } from "../domain/inventory-types";
import { AdjustStockCommand, ConsumeDigitalProductCommand, CreateProductCommand, GetInventoryBalanceCommand, InventoryRepository, StockInCommand, StockOutCommand, TransferStockCommand, UpdatePriceCommand, UpdateProductCommand } from "./inventory-repository";

export class InventoryService {
  constructor(private readonly repo: InventoryRepository, private readonly journal: JournalPostingService, private readonly floatService?: FloatManagementService, private readonly engine = new InventoryEngine()) {}

  async createProduct(command: CreateProductCommand) {
    const ctx = this.ctx(command);
    const accountIds = [command.inventoryAccountId, command.cogsAccountId, command.revenueAccountId].filter((id): id is string => Boolean(id));
    const [accounts, category] = await Promise.all([this.repo.findAccounts(ctx, accountIds), command.categoryId ? this.repo.findCategory(ctx, command.categoryId) : Promise.resolve(null)]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    this.engine.validateCreateProduct(command, { category, inventoryAccount: command.inventoryAccountId ? byId.get(command.inventoryAccountId) ?? null : null, cogsAccount: command.cogsAccountId ? byId.get(command.cogsAccountId) ?? null : null, revenueAccount: byId.get(command.revenueAccountId) ?? null });
    const product = await this.repo.createProduct(ctx, command);
    if (command.type === "DIGITAL" && command.provider && command.providerSku && command.floatAccountId) {
      const providerInput = { productId: product.id, provider: command.provider, providerSku: command.providerSku, floatAccountId: command.floatAccountId } as { productId: string; provider: string; providerSku: string; floatAccountId: string; dynamicBuyPrice?: bigint; dynamicSellPrice?: bigint };
      if (command.buyPrice !== undefined) providerInput.dynamicBuyPrice = command.buyPrice;
      if (command.sellPrice !== undefined) providerInput.dynamicSellPrice = command.sellPrice;
      await this.repo.createProviderProduct(ctx, providerInput);
    }
    if (command.buyPrice !== undefined) await this.repo.createPrice(ctx, { businessId: ctx.businessId, productId: product.id, priceType: "BUY", amount: command.buyPrice, effectiveDate: new Date() });
    if (command.sellPrice !== undefined) await this.repo.createPrice(ctx, { businessId: ctx.businessId, productId: product.id, priceType: "SELL", amount: command.sellPrice, effectiveDate: new Date() });
    await this.audit(ctx, "PRODUCT_CREATED", "product", product.id, { sku: product.sku, type: product.type });
    return product;
  }

  async updateProduct(command: UpdateProductCommand) {
    const ctx = this.ctx(command);
    const accountIds = [command.inventoryAccountId, command.cogsAccountId, command.revenueAccountId].filter((id): id is string => Boolean(id));
    const [existing, accounts, category] = await Promise.all([this.repo.findProduct(ctx, command.productId), this.repo.findAccounts(ctx, accountIds), command.categoryId ? this.repo.findCategory(ctx, command.categoryId) : Promise.resolve(null)]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    this.engine.validateUpdateProduct(command, existing, { category, inventoryAccount: command.inventoryAccountId ? byId.get(command.inventoryAccountId) ?? null : null, cogsAccount: command.cogsAccountId ? byId.get(command.cogsAccountId) ?? null : null, revenueAccount: byId.get(command.revenueAccountId) ?? null });
    const product = await this.repo.updateProduct(ctx, command.productId, command);
    await this.audit(ctx, "PRODUCT_UPDATED", "product", product.id, { sku: product.sku, type: product.type });
    return product;
  }

  async updatePrice(command: UpdatePriceCommand) {
    const ctx = this.ctx(command);
    const product = await this.repo.findProduct(ctx, command.productId);
    this.engine.validateUpdatePrice(command, product);
    const price = await this.repo.createPrice(ctx, command);
    const [buy, sell] = await Promise.all([this.repo.findActivePrice(ctx, command.productId, "BUY", command.effectiveDate), this.repo.findActivePrice(ctx, command.productId, "SELL", command.effectiveDate)]);
    const history = this.engine.priceHistory(command.productId, command.priceType === "BUY" ? price : buy, command.priceType === "SELL" ? price : sell, command.effectiveDate);
    await this.repo.createCostHistory(ctx, { businessId: ctx.businessId, ...history, source: "PRICE_UPDATE" });
    await this.audit(ctx, "PRODUCT_PRICE_UPDATED", "product_price", price.id, { productId: command.productId, priceType: price.priceType, amount: price.amount.toString() });
    return price;
  }

  async stockIn(command: StockInCommand) {
    const ctx = this.ctx(command); const context = await this.stockContext(ctx, command.productId, command.locationId); const result = this.engine.stockIn(command, context);
    const journal = await this.post(ctx, command.movementDate, "INVENTORY_STOCK_IN", command.productId, command.description, result.preview.lines, "stock-in:" + ctx.businessId + ":" + command.productId + ":" + command.locationId + ":" + command.movementDate.toISOString() + ":" + command.quantity.toString() + ":" + command.unitCost.toString());
    const balance = await this.repo.atomicStockIn(ctx, command.productId, command.locationId, command.quantity, command.unitCost); const movement = await this.repo.createMovement(ctx, { ...result.movement, balanceAfter: balance.quantity, averageCostAfter: balance.averageCost, postedJournalId: journal.journalId });
    await this.repo.createCostHistory(ctx, { businessId: ctx.businessId, productId: command.productId, buyPrice: command.unitCost, effectiveDate: command.movementDate, source: "STOCK_IN" });
    await this.audit(ctx, "INVENTORY_STOCK_IN", "inventory_movement", movement.id, { quantity: command.quantity.toString(), averageCost: balance.averageCost.toString() });
    return { balance, movement, journal, preview: result.preview };
  }

  async stockOut(command: StockOutCommand) {
    const ctx = this.ctx(command); const context = await this.stockContext(ctx, command.productId, command.locationId); const result = this.engine.stockOut(command, context);
    const journal = await this.post(ctx, command.movementDate, "INVENTORY_STOCK_OUT", command.productId, command.description, result.preview.lines, "stock-out:" + ctx.businessId + ":" + command.productId + ":" + command.locationId + ":" + command.movementDate.toISOString() + ":" + command.quantity.toString());
    const balance = await this.repo.atomicStockOut(ctx, command.productId, command.locationId, command.quantity); const movement = await this.repo.createMovement(ctx, { ...result.movement, balanceAfter: balance.quantity, averageCostAfter: balance.averageCost, postedJournalId: journal.journalId });
    await this.audit(ctx, "INVENTORY_STOCK_OUT", "inventory_movement", movement.id, { quantity: command.quantity.toString(), totalCost: result.movement.totalCost.toString() });
    return { balance, movement, journal, preview: result.preview };
  }

  async adjustStock(command: AdjustStockCommand) {
    const ctx = this.ctx(command); const context = await this.stockContext(ctx, command.productId, command.locationId); const result = this.engine.adjustStock(command, context);
    const journal = await this.post(ctx, command.movementDate, "INVENTORY_ADJUSTMENT", command.productId, command.description, result.preview.lines, "stock-adjust:" + ctx.businessId + ":" + command.productId + ":" + command.locationId + ":" + command.movementDate.toISOString() + ":" + command.newQuantity.toString());
    const balance = await this.repo.upsertBalance(ctx, result.balance); const movement = await this.repo.createMovement(ctx, { ...result.movement, type: "ADJUSTMENT", postedJournalId: journal.journalId });
    await this.audit(ctx, "INVENTORY_ADJUSTED", "inventory_movement", movement.id, { newQuantity: command.newQuantity.toString() });
    return { balance, movement, journal, preview: result.preview };
  }

  async transferStock(command: TransferStockCommand) {
    const ctx = this.ctx(command); const from = await this.stockContext(ctx, command.productId, command.fromLocationId); const toBalance = await this.repo.findBalance(ctx, command.productId, command.toLocationId); const result = this.engine.transferStock(command, from, toBalance);
    await this.repo.upsertBalance(ctx, result.fromBalance); const destination = await this.repo.upsertBalance(ctx, result.toBalance); const movement = await this.repo.createMovement(ctx, { ...result.movement, postedJournalId: null });
    await this.audit(ctx, "INVENTORY_TRANSFERRED", "inventory_movement", movement.id, { quantity: command.quantity.toString(), toLocationId: command.toLocationId });
    return { fromBalance: result.fromBalance, toBalance: destination, movement };
  }

  async consumeDigitalProduct(command: ConsumeDigitalProductCommand) {
    const ctx = this.ctx(command); const product = await this.repo.findProduct(ctx, command.productId); const providerProduct = await this.repo.findProviderProduct(ctx, command.productId, command.providerProductId); const totalCost = this.engine.validateDigitalConsumption(command, { product, providerProduct });
    if (!this.floatService) throw new InventoryError("FLOAT_SERVICE_REQUIRED", "Digital product consumption requires FloatManagementService.");
    const consumeCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, floatAccountId: providerProduct!.floatAccountId, transactionDate: command.transactionDate, amount: totalCost, description: command.description };
    if (product!.cogsAccountId !== null && product!.cogsAccountId !== undefined) Object.assign(consumeCommand, { expenseAccountId: product!.cogsAccountId });
    const result = await this.floatService.consumeFloat(consumeCommand);
    const movement = await this.repo.createMovement(ctx, { businessId: ctx.businessId, productId: command.productId, type: "DIGITAL_CONSUMPTION", movementDate: command.transactionDate, quantity: command.quantity, unitCost: providerProduct!.dynamicBuyPrice!, totalCost, balanceAfter: 0n, averageCostAfter: 0n, postedJournalId: result.journal.journalId, description: command.description });
    await this.repo.createCostHistory(ctx, { businessId: ctx.businessId, productId: command.productId, buyPrice: providerProduct!.dynamicBuyPrice!, sellPrice: providerProduct!.dynamicSellPrice ?? null, effectiveDate: command.transactionDate, source: "DIGITAL_PROVIDER" });
    await this.audit(ctx, "DIGITAL_PRODUCT_CONSUMED", "inventory_movement", movement.id, { totalCost: totalCost.toString(), provider: providerProduct!.provider });
    return { movement, float: result };
  }

  async getInventoryBalance(command: GetInventoryBalanceCommand): Promise<InventoryBalanceEntity> { const ctx = this.ctx(command); return await this.repo.findBalance(ctx, command.productId, command.locationId) ?? { id: "", businessId: ctx.businessId, productId: command.productId, locationId: command.locationId, quantity: 0n, averageCost: 0n, inventoryValue: 0n }; }

  private async stockContext(ctx: TenantContext, productId: string, locationId: string): Promise<InventoryValidationContext> { const product = await this.repo.findProduct(ctx, productId); const ids = [product?.inventoryAccountId, product?.cogsAccountId, product?.revenueAccountId].filter((id): id is string => Boolean(id)); const [accounts, balance] = await Promise.all([this.repo.findAccounts(ctx, ids), this.repo.findBalance(ctx, productId, locationId)]); const byId = new Map(accounts.map((a) => [a.id, a])); return { product, balance, inventoryAccount: product?.inventoryAccountId ? byId.get(product.inventoryAccountId) ?? null : null, cogsAccount: product?.cogsAccountId ? byId.get(product.cogsAccountId) ?? null : null, revenueAccount: product?.revenueAccountId ? byId.get(product.revenueAccountId) ?? null : null }; }
  private async post(ctx: TenantContext, date: Date, source: string, sourceId: string, description: string, lines: PostJournalCommand["lines"], idempotencyKey: string) { const command: PostJournalCommand = { businessId: ctx.businessId, actorUserId: ctx.actorUserId, transactionDate: date, source, sourceId, description: description.trim(), idempotencyKey, lines: lines.map((line) => ({ accountId: line.accountId, side: line.side, amount: line.amount })) }; if (ctx.requestId !== undefined) command.requestId = ctx.requestId; if (ctx.ipAddress !== undefined) command.ipAddress = ctx.ipAddress; if (ctx.userAgent !== undefined) command.userAgent = ctx.userAgent; return this.journal.post(command); }
  private async audit(ctx: TenantContext, action: Parameters<InventoryRepository["createAuditLog"]>[1]["action"], entityType: Parameters<InventoryRepository["createAuditLog"]>[1]["entityType"], entityId: string, metadata: Record<string, unknown>) { await this.repo.createAuditLog(ctx, { action, businessId: ctx.businessId, actorUserId: ctx.actorUserId, entityType, entityId, metadata }); }
  private ctx(command: { businessId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string }): TenantContext { const ctx: TenantContext = { businessId: command.businessId, actorUserId: command.actorUserId }; if (command.requestId !== undefined) ctx.requestId = command.requestId; if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress; if (command.userAgent !== undefined) ctx.userAgent = command.userAgent; return ctx; }
}
