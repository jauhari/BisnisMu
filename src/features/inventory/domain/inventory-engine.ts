import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { AdjustStockInput, ConsumeDigitalProductInput, CreateProductInput, InventoryBalanceEntity, InventoryError, InventoryJournalPreview, InventoryMovementEntity, InventoryValidationContext, ProductEntity, ProductPriceEntity, StockInInput, StockOutInput, TransferStockInput, UpdatePriceInput, UpdateProductInput } from "./inventory-types";

export class InventoryEngine {
  validateCreateProduct(input: CreateProductInput, context: InventoryValidationContext): void {
    if (!input.businessId) throw new InventoryError("TENANT_REQUIRED", "businessId is required.");
    if (!input.sku.trim()) throw new InventoryError("SKU_REQUIRED", "Product SKU is required.");
    if (!input.name.trim()) throw new InventoryError("PRODUCT_NAME_REQUIRED", "Product name is required.");
    this.assertRevenueAccount(input.revenueAccountId, context.revenueAccount ?? null, input.businessId, "revenueAccountId");
    if (input.type === "PHYSICAL") { this.assertAssetAccount(input.inventoryAccountId ?? "", context.inventoryAccount ?? null, input.businessId, "inventoryAccountId"); this.assertCogsAccount(input.cogsAccountId ?? "", context.cogsAccount ?? null, input.businessId, "cogsAccountId"); }
    if (input.type === "DIGITAL" && (!input.provider || !input.providerSku || !input.floatAccountId)) throw new InventoryError("PROVIDER_MAPPING_REQUIRED", "Digital product requires provider, providerSku, and floatAccountId.");
  }

  validateUpdateProduct(input: UpdateProductInput, existing: ProductEntity | null, context: InventoryValidationContext): void {
    if (!input.businessId) throw new InventoryError("TENANT_REQUIRED", "businessId is required.");
    this.assertProduct(input.productId, existing, input.businessId);
    if (!input.sku.trim()) throw new InventoryError("SKU_REQUIRED", "Product SKU is required.");
    if (!input.name.trim()) throw new InventoryError("PRODUCT_NAME_REQUIRED", "Product name is required.");
    this.assertRevenueAccount(input.revenueAccountId, context.revenueAccount ?? null, input.businessId, "revenueAccountId");
    if (input.type === "PHYSICAL") { this.assertAssetAccount(input.inventoryAccountId ?? "", context.inventoryAccount ?? null, input.businessId, "inventoryAccountId"); this.assertCogsAccount(input.cogsAccountId ?? "", context.cogsAccount ?? null, input.businessId, "cogsAccountId"); }
  }

  validateUpdatePrice(input: UpdatePriceInput, product: ProductEntity | null): void {
    this.assertProduct(input.productId, product, input.businessId);
    this.assertPositive(input.amount, "amount");
  }

  priceHistory(productId: string, buy: ProductPriceEntity | null, sell: ProductPriceEntity | null, effectiveDate: Date) {
    const buyPrice = buy?.amount ?? 0n;
    const sellPrice = sell?.amount ?? null;
    const marginAmount = sellPrice === null ? null : sellPrice - buyPrice;
    const marginRateBps = sellPrice === null || sellPrice === 0n ? null : (marginAmount! * 10000n) / sellPrice;
    return { productId, buyPrice, sellPrice, marginAmount, marginRateBps, effectiveDate };
  }

  stockIn(input: StockInInput, context: InventoryValidationContext): { balance: InventoryBalanceEntity; movement: Omit<InventoryMovementEntity, "id" | "postedJournalId">; preview: InventoryJournalPreview } {
    const product = this.assertPhysical(input.productId, context.product ?? null, input.businessId);
    this.assertPositive(input.quantity, "quantity"); this.assertPositive(input.unitCost, "unitCost");
    this.assertAssetAccount(product.inventoryAccountId ?? "", context.inventoryAccount ?? null, input.businessId, "inventoryAccountId");
    const current = context.balance ?? this.emptyBalance(input.businessId, input.productId, input.locationId);
    const incomingValue = input.quantity * input.unitCost;
    const nextQty = current.quantity + input.quantity;
    const nextValue = current.inventoryValue + incomingValue;
    const averageCost = nextQty === 0n ? 0n : nextValue / nextQty;
    const balance = { ...current, quantity: nextQty, averageCost, inventoryValue: nextValue };
    const movement = { businessId: input.businessId, productId: input.productId, type: "STOCK_IN" as const, movementDate: input.movementDate, quantity: input.quantity, unitCost: input.unitCost, totalCost: incomingValue, toLocationId: input.locationId, balanceAfter: nextQty, averageCostAfter: averageCost, description: input.description };
    const preview = this.preview(input.businessId, input.movementDate, "INVENTORY_STOCK_IN", input.description, [this.line(context.inventoryAccount!, "DEBIT", incomingValue), this.line(context.inventoryAccount!, "CREDIT", incomingValue)]);
    return { balance, movement, preview };
  }

  stockOut(input: StockOutInput, context: InventoryValidationContext): { balance: InventoryBalanceEntity; movement: Omit<InventoryMovementEntity, "id" | "postedJournalId">; preview: InventoryJournalPreview } {
    const product = this.assertPhysical(input.productId, context.product ?? null, input.businessId);
    this.assertPositive(input.quantity, "quantity");
    this.assertAssetAccount(product.inventoryAccountId ?? "", context.inventoryAccount ?? null, input.businessId, "inventoryAccountId"); this.assertCogsAccount(product.cogsAccountId ?? "", context.cogsAccount ?? null, input.businessId, "cogsAccountId");
    const current = context.balance ?? this.emptyBalance(input.businessId, input.productId, input.locationId);
    if (input.quantity > current.quantity) throw new InventoryError("NEGATIVE_STOCK", "Stock out cannot exceed available quantity.", { available: current.quantity.toString(), requested: input.quantity.toString() });
    const totalCost = input.quantity * current.averageCost;
    const nextQty = current.quantity - input.quantity;
    const nextValue = current.inventoryValue - totalCost;
    const balance = { ...current, quantity: nextQty, inventoryValue: nextValue < 0n ? 0n : nextValue, averageCost: nextQty === 0n ? 0n : current.averageCost };
    const movement = { businessId: input.businessId, productId: input.productId, type: "STOCK_OUT" as const, movementDate: input.movementDate, quantity: input.quantity, unitCost: current.averageCost, totalCost, fromLocationId: input.locationId, balanceAfter: nextQty, averageCostAfter: balance.averageCost, description: input.description };
    const preview = this.preview(input.businessId, input.movementDate, "INVENTORY_STOCK_OUT", input.description, [this.line(context.cogsAccount!, "DEBIT", totalCost), this.line(context.inventoryAccount!, "CREDIT", totalCost)]);
    return { balance, movement, preview };
  }

  adjustStock(input: AdjustStockInput, context: InventoryValidationContext) {
    const current = context.balance ?? this.emptyBalance(input.businessId, input.productId, input.locationId);
    if (input.newQuantity < 0n) throw new InventoryError("NEGATIVE_STOCK", "Adjusted stock cannot be negative.");
    if (input.newQuantity >= current.quantity) return this.stockIn({ businessId: input.businessId, productId: input.productId, locationId: input.locationId, movementDate: input.movementDate, quantity: input.newQuantity - current.quantity, unitCost: input.unitCost ?? current.averageCost, description: input.description }, context);
    return this.stockOut({ businessId: input.businessId, productId: input.productId, locationId: input.locationId, movementDate: input.movementDate, quantity: current.quantity - input.newQuantity, description: input.description }, context);
  }

  transferStock(input: TransferStockInput, from: InventoryValidationContext, toBalance: InventoryBalanceEntity | null) {
    const out = this.stockOut({ businessId: input.businessId, productId: input.productId, locationId: input.fromLocationId, movementDate: input.movementDate, quantity: input.quantity, description: input.description }, from);
    const destination = toBalance ?? this.emptyBalance(input.businessId, input.productId, input.toLocationId);
    const nextQty = destination.quantity + input.quantity;
    const nextValue = destination.inventoryValue + out.movement.totalCost;
    const averageCost = nextQty === 0n ? 0n : nextValue / nextQty;
    const inBalance = { ...destination, quantity: nextQty, inventoryValue: nextValue, averageCost };
    const movement = { ...out.movement, type: "TRANSFER" as const, fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, balanceAfter: out.balance.quantity, averageCostAfter: out.balance.averageCost };
    return { fromBalance: out.balance, toBalance: inBalance, movement, preview: out.preview };
  }

  validateDigitalConsumption(input: ConsumeDigitalProductInput, context: InventoryValidationContext): bigint {
    const product = this.assertProduct(input.productId, context.product ?? null, input.businessId);
    if (product.type !== "DIGITAL") throw new InventoryError("PRODUCT_NOT_DIGITAL", "Only digital products can consume provider float.");
    this.assertPositive(input.quantity, "quantity");
    if (!context.providerProduct || !context.providerProduct.isActive || context.providerProduct.businessId !== input.businessId) throw new InventoryError("PROVIDER_PRODUCT_NOT_FOUND", "Provider product mapping was not found in this business.");
    const unitCost = context.providerProduct.dynamicBuyPrice;
    if (unitCost === null || unitCost === undefined || unitCost <= 0n) throw new InventoryError("BUY_PRICE_REQUIRED", "Digital product requires a provider buy price.");
    return unitCost * input.quantity;
  }

  private assertPhysical(productId: string, product: ProductEntity | null, businessId: string): ProductEntity { const p = this.assertProduct(productId, product, businessId); if (p.type !== "PHYSICAL" || !p.trackStock) throw new InventoryError("PRODUCT_NOT_STOCKED", "Product does not track physical inventory.", { productId }); return p; }
  private assertProduct(productId: string, product: ProductEntity | null, businessId: string): ProductEntity { if (!product) throw new InventoryError("PRODUCT_NOT_FOUND", "Product was not found in this business.", { productId }); if (product.businessId !== businessId) throw new InventoryError("TENANT_PRODUCT_MISMATCH", "Product must belong to the same business.", { productId }); if (!product.isActive) throw new InventoryError("PRODUCT_INACTIVE", "Product must be active.", { productId }); return product; }
  private assertPositive(value: bigint, field: string): void { if (value <= 0n) throw new InventoryError("INVALID_AMOUNT", field + " must be greater than zero."); }
  private assertAssetAccount(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPostingAccount(id, account, businessId, field); if (!account || account.groupCode !== 1) throw new InventoryError("ACCOUNT_NOT_ASSET", "Account must be an asset account.", { accountId: id, field }); }
  private assertCogsAccount(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPostingAccount(id, account, businessId, field); if (!account || account.groupCode !== 5) throw new InventoryError("ACCOUNT_NOT_COGS", "COGS account must be a COGS account.", { accountId: id, field }); }
  private assertRevenueAccount(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { this.assertPostingAccount(id, account, businessId, field); if (!account || account.groupCode !== 4) throw new InventoryError("ACCOUNT_NOT_REVENUE", "Revenue account must be a revenue account.", { accountId: id, field }); }
  private assertPostingAccount(id: string, account: AccountSnapshot | null, businessId: string, field: string): void { if (!account) throw new InventoryError("ACCOUNT_NOT_FOUND", "Account was not found in this business.", { accountId: id, field }); if (account.businessId !== businessId) throw new InventoryError("TENANT_ACCOUNT_MISMATCH", "Account must belong to the same business.", { accountId: id, field }); if (!account.isActive || !account.isPostingAllowed) throw new InventoryError("ACCOUNT_NOT_POSTABLE", "Account must be active and posting-enabled.", { accountId: id, field }); }
  private emptyBalance(businessId: string, productId: string, locationId: string): InventoryBalanceEntity { return { id: "", businessId, productId, locationId, quantity: 0n, averageCost: 0n, inventoryValue: 0n }; }
  private preview(businessId: string, transactionDate: Date, source: string, description: string, lines: InventoryJournalPreview["lines"]): InventoryJournalPreview { const totalDebit = lines.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + line.amount, 0n); const totalCredit = lines.filter((line) => line.side === "CREDIT").reduce((sum, line) => sum + line.amount, 0n); return { businessId, transactionDate, source, description, lines, totalDebit, totalCredit }; }
  private line(account: AccountSnapshot, side: "DEBIT" | "CREDIT", amount: bigint) { return { accountId: account.id, side, amount, accountCode: account.code, accountName: account.name }; }
}
