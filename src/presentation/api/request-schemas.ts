import { z } from "zod";

import { dateSchema, nonNegativeMoneySchema, optionalUuidSchema, positiveMoneySchema, positiveQuantitySchema, uuidSchema } from "./validation";

const stringRequired = z.string().min(1);
const optionalString = z.string().min(1).optional();

export const idOnlySchema = (field: string) => z.object({ [field]: uuidSchema });
export const dateRangeCommandSchema = z.object({ command: z.object({ startsOn: dateSchema, endsOn: dateSchema }) });

export const journalSchema = z.object({
  transactionDate: dateSchema,
  source: stringRequired,
  sourceId: optionalString,
  description: stringRequired,
  idempotencyKey: optionalString,
  lines: z.array(z.object({ accountId: uuidSchema, side: z.enum(["DEBIT", "CREDIT"]), amount: positiveMoneySchema })).min(2),
});

export const chartOfAccountSchema = z.object({
  code: stringRequired,
  name: stringRequired,
  groupCode: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE", "OTHER_EXPENSE"]),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  subtype: optionalString,
  description: optionalString,
  parentId: optionalUuidSchema,
  parentCode: optionalString,
  isSystem: z.boolean().optional(),
  isPostingAllowed: z.boolean().optional(),
});

export const contactSchema = z.object({
  name: stringRequired,
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH", "OTHER"]).optional(),
  phone: optionalString,
  email: z.string().email().optional(),
  address: optionalString,
  npwpNumber: optionalString,
});

export const partySchema = z.object({
  name: stringRequired,
  email: z.string().email().optional(),
  phone: optionalString,
  address: optionalString,
});

export const productCategorySchema = z.object({
  name: stringRequired,
  parentId: optionalUuidSchema,
  description: optionalString,
});

export const floatAccountSchema = z.object({
  provider: stringRequired,
  name: stringRequired,
  floatAssetAccountId: uuidSchema,
  offsetAccountId: uuidSchema,
  providerAccountId: optionalString,
  openingBalance: nonNegativeMoneySchema.optional(),
});

export const invoiceSchema = z.object({
  customerId: uuidSchema,
  issueDate: dateSchema,
  dueDate: dateSchema.optional(),
  arAccountId: uuidSchema,
  revenueAccountId: uuidSchema,
  description: optionalString,
  amount: nonNegativeMoneySchema.optional(),
  lines: z.array(z.record(z.unknown())).optional(),
}).passthrough();

export const billSchema = z.object({
  vendorId: uuidSchema,
  issueDate: dateSchema,
  dueDate: dateSchema.optional(),
  apAccountId: uuidSchema,
  expenseAccountId: uuidSchema.optional(),
  description: optionalString,
  amount: nonNegativeMoneySchema.optional(),
  lines: z.array(z.record(z.unknown())).optional(),
}).passthrough();

export const arApPaymentSchema = z.object({
  direction: z.enum(["CUSTOMER_PAYMENT", "VENDOR_PAYMENT"]),
  targetId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
  billId: uuidSchema.optional(),
  paymentDate: dateSchema.optional(),
  amount: positiveMoneySchema,
  cashAccountId: uuidSchema,
  description: optionalString,
}).passthrough();

export const inventoryProductSchema = z.object({
  type: z.enum(["PHYSICAL", "DIGITAL", "SERVICE"]),
  sku: stringRequired,
  name: stringRequired,
  description: optionalString,
  categoryId: optionalUuidSchema,
  barcode: optionalString,
  inventoryAccountId: optionalUuidSchema,
  cogsAccountId: optionalUuidSchema,
  revenueAccountId: uuidSchema,
  trackStock: z.boolean().optional(),
  buyPrice: nonNegativeMoneySchema.optional(),
  sellPrice: nonNegativeMoneySchema.optional(),
  provider: z.enum(["FASTPAY", "PAYFAZZ", "BUKUWARUNG", "SHOPEEPAY", "LINKAJA", "CUSTOM"]).optional(),
  providerSku: optionalString,
  floatAccountId: optionalUuidSchema,
});

export const inventoryStockInSchema = z.object({
  productId: uuidSchema,
  locationId: uuidSchema,
  movementDate: dateSchema,
  quantity: positiveQuantitySchema,
  unitCost: nonNegativeMoneySchema,
  description: stringRequired,
});

const purchaseItemSchema = z.object({
  productId: uuidSchema,
  description: optionalString,
  quantity: positiveQuantitySchema,
  unitCost: nonNegativeMoneySchema,
  discountAmount: nonNegativeMoneySchema.optional(),
  taxAmount: nonNegativeMoneySchema.optional(),
});

export const purchaseOrderSchema = z.object({
  supplierId: uuidSchema,
  orderDate: dateSchema,
  expectedDate: dateSchema.optional(),
  notes: optionalString,
  grniAccountId: uuidSchema,
  apAccountId: uuidSchema,
  items: z.array(purchaseItemSchema).min(1),
});

// locationId/warehouseId is a free-form label (no Location entity in the schema),
// so it is validated as a non-empty string rather than a cuid/uuid.
const locationLabelSchema = z.string().min(1);

export const purchaseReceiptSchema = z.object({
  purchaseOrderId: uuidSchema,
  receiptDate: dateSchema,
  notes: optionalString,
  items: z.array(z.object({ productId: uuidSchema, quantity: positiveQuantitySchema, locationId: locationLabelSchema }).passthrough()).min(1),
}).passthrough();

export const purchaseReturnSchema = z.object({
  purchaseOrderId: uuidSchema,
  returnDate: dateSchema,
  reason: stringRequired,
  items: z.array(z.object({ productId: uuidSchema, quantity: positiveQuantitySchema, locationId: locationLabelSchema }).passthrough()).min(1),
}).passthrough();

export const vendorBillSchema = z.object({
  purchaseOrderId: uuidSchema,
  billDate: dateSchema,
  dueDate: dateSchema,
  description: stringRequired,
  expenseAccountId: optionalUuidSchema,
});

export const inventoryAdjustmentSchema = z.object({
  productId: uuidSchema,
  locationId: locationLabelSchema,
  movementDate: dateSchema,
  newQuantity: nonNegativeMoneySchema,
  unitCost: nonNegativeMoneySchema.optional(),
  description: stringRequired,
});

export const inventoryTransferSchema = z.object({
  productId: uuidSchema,
  fromLocationId: locationLabelSchema,
  toLocationId: locationLabelSchema,
  movementDate: dateSchema,
  quantity: positiveQuantitySchema,
  description: stringRequired,
});

export const cashTransferSchema = z.object({
  sessionId: optionalUuidSchema,
  sourceCashAccountId: uuidSchema,
  destinationCashAccountId: uuidSchema,
  movementDate: dateSchema,
  amount: positiveMoneySchema,
  description: stringRequired,
});

export const cashSessionOpenSchema = z.object({
  drawerId: uuidSchema,
  openedAt: dateSchema,
  openingAmount: nonNegativeMoneySchema,
  equityAccountId: uuidSchema,
  shiftCode: optionalString,
});

export const cashSessionCloseSchema = z.object({
  sessionId: uuidSchema,
  closedAt: dateSchema,
  countedAmount: nonNegativeMoneySchema,
  differenceAccountId: uuidSchema,
});


const salesItemSchema = z.object({
  productId: uuidSchema,
  quantity: positiveQuantitySchema,
  unitPrice: nonNegativeMoneySchema.optional(),
  discountAmount: nonNegativeMoneySchema.optional(),
  taxAmount: nonNegativeMoneySchema.optional(),
  locationId: optionalUuidSchema,
  providerProductId: optionalUuidSchema,
  priceId: optionalUuidSchema,
});

export const salesOrderSchema = z.object({
  customerId: uuidSchema,
  saleDate: dateSchema,
  description: stringRequired,
  revenueSettlementAccountId: uuidSchema,
  arAccountId: optionalUuidSchema,
  items: z.array(salesItemSchema).min(1),
});

export const salesPaymentSchema = z.object({
  salesOrderId: uuidSchema,
  allocations: z.array(z.object({ method: z.string().min(1), amount: positiveMoneySchema }).passthrough()).min(1),
});

export const posSessionSchema = z.object({ terminalId: uuidSchema, openedAt: dateSchema.optional(), openingCashAmount: nonNegativeMoneySchema.optional() }).passthrough();
export const posSessionCloseSchema = z.object({ sessionId: uuidSchema, closedAt: dateSchema.optional(), closingCashAmount: nonNegativeMoneySchema.optional() }).passthrough();
export const posCartSchema = z.object({ sessionId: uuidSchema, productId: uuidSchema, quantity: positiveQuantitySchema }).passthrough();
export const posCheckoutSchema = z.object({ transactionId: uuidSchema, saleDate: dateSchema, description: stringRequired, revenueSettlementAccountId: uuidSchema, arAccountId: optionalUuidSchema });
export const posPaymentSchema = z.object({ transactionId: uuidSchema, amount: positiveMoneySchema, method: z.string().min(1) }).passthrough();
export const posVoidSchema = z.object({ transactionId: uuidSchema, reason: stringRequired });
export const posTerminalSchema = z.object({ name: stringRequired, cashDrawerId: optionalUuidSchema });

export const cashDrawerSchema = z.object({ name: stringRequired, cashAccountId: uuidSchema });
export const cashTransactionSchema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT", "TRANSFER"]),
  transactionDate: dateSchema,
  cashAccountId: uuidSchema,
  amount: positiveMoneySchema,
  description: stringRequired,
  destinationAccountId: optionalUuidSchema,
  categoryAccountId: optionalUuidSchema,
  contactId: optionalUuidSchema,
  paymentMethod: optionalString,
  referenceNumber: optionalString,
  attachmentKey: optionalString,
  tags: z.array(z.string()).optional(),
});
export const cashPostSchema = idOnlySchema("transactionId");
export const cashVoidSchema = z.object({ transactionId: uuidSchema, reason: stringRequired });

export const floatTransactionSchema = z.object({
  floatAccountId: uuidSchema,
  destinationFloatAccountId: optionalUuidSchema,
  cashAccountId: optionalUuidSchema,
  type: z.enum(["TOPUP", "CONSUME", "TRANSFER", "ADJUSTMENT"]),
  transactionDate: dateSchema,
  amount: positiveMoneySchema,
  description: stringRequired,
}).passthrough();

export const settingsSchema = z.object({ name: optionalString, npwpNumber: optionalString, address: optionalString, fiscalYearStart: z.coerce.number().int().min(1).max(12).optional(), settings: z.record(z.unknown()).optional() }).passthrough();
export const fiscalPeriodSchema = z.object({ fiscalYear: z.number().int().min(1900).max(9999) }).passthrough();
export const beginningBalancesSchema = z.object({ fiscalPeriodId: uuidSchema, lines: z.array(z.object({ accountId: uuidSchema, side: z.enum(["DEBIT", "CREDIT"]), amount: nonNegativeMoneySchema })).min(1) }).passthrough();
export const selectBusinessSchema = z.object({ businessId: uuidSchema });
export const dashboardRequestSchema = z.object({ startsOn: dateSchema, endsOn: dateSchema, lowStockThreshold: positiveQuantitySchema.optional(), lowFloatThreshold: nonNegativeMoneySchema.optional() });
export const reportRequestSchema = z.object({ command: z.object({ startsOn: dateSchema.optional(), endsOn: dateSchema.optional(), asOf: dateSchema.optional() }).passthrough() });
export const posCartAddSchema = z.object({
  sessionId: uuidSchema,
  transactionId: optionalUuidSchema,
  customerId: uuidSchema,
  productId: optionalUuidSchema,
  barcode: optionalString,
  quantity: positiveQuantitySchema,
  unitPrice: nonNegativeMoneySchema.optional(),
  priceId: optionalUuidSchema,
  discountAmount: nonNegativeMoneySchema.optional(),
  discountPercentBps: nonNegativeMoneySchema.optional(),
  taxAmount: nonNegativeMoneySchema.optional(),
  locationId: optionalUuidSchema,
  providerProductId: optionalUuidSchema,
});
export const posCartDeleteSchema = z.object({ transactionId: uuidSchema, cartItemId: uuidSchema });

// --- Revenue module ---
const revenueTypeEnum = z.enum(["TICKET", "PACKAGE", "PARKING", "RENTAL", "TENANT_RENT", "SERVICE", "PRODUCT_SALE", "OTHER_REVENUE"]);
const revenuePricingTypeEnum = z.enum(["STANDARD", "TIER", "DAILY", "WEEKEND", "SEASONAL", "PACKAGE"]);
const positiveIntSchema = z.coerce.number().int().positive();

export const revenueCategorySchema = z.object({ name: stringRequired, type: revenueTypeEnum, revenueAccountId: uuidSchema, description: optionalString });
export const revenueItemSchema = z.object({ categoryId: uuidSchema, name: stringRequired, sku: optionalString, description: optionalString });
export const revenuePackageSchema = z.object({ categoryId: uuidSchema, name: stringRequired, description: optionalString });
export const revenuePricingSchema = z.object({ itemId: optionalUuidSchema, packageId: optionalUuidSchema, type: revenuePricingTypeEnum, tierName: optionalString, amount: positiveMoneySchema, startsOn: dateSchema.optional(), endsOn: dateSchema.optional(), dayOfWeek: z.coerce.number().int().min(0).max(6).optional(), minQuantity: positiveIntSchema.optional(), maxQuantity: positiveIntSchema.optional() });
export const revenueDraftSchema = z.object({ type: revenueTypeEnum, transactionDate: dateSchema, categoryId: uuidSchema, itemId: optionalUuidSchema, packageId: optionalUuidSchema, pricingId: optionalUuidSchema, cashAccountId: uuidSchema, quantity: positiveIntSchema, unitPrice: nonNegativeMoneySchema.optional(), description: stringRequired, contactId: optionalUuidSchema });
export const revenuePostSchema = z.object({ transactionId: uuidSchema });
export const revenueVoidSchema = z.object({ transactionId: uuidSchema, reason: z.string().min(10, "Void reason must be at least 10 characters") });

// --- Tourism module ---
const rentalTypeEnum = z.enum(["GAZEBO", "AREA", "EVENT"]);
const visitorSourceEnum = z.enum(["ENTRANCE_TICKET", "PACKAGE_TICKET", "PARKING_FEE", "GAZEBO_RENTAL", "AREA_RENTAL", "TENANT_RENTAL", "EVENT_RENTAL"]);

export const attractionSchema = z.object({ name: stringRequired, description: optionalString, location: optionalString, visitorLimit: positiveIntSchema.optional(), startsOn: dateSchema.optional(), endsOn: dateSchema.optional() });
export const ticketTypeSchema = z.object({ attractionId: uuidSchema, name: stringRequired, revenueCategoryId: uuidSchema, dailyPrice: positiveMoneySchema, weekendPrice: nonNegativeMoneySchema.optional(), seasonalPrice: nonNegativeMoneySchema.optional(), seasonalStartsOn: dateSchema.optional(), seasonalEndsOn: dateSchema.optional(), visitorLimit: positiveIntSchema.optional(), startsOn: dateSchema.optional(), endsOn: dateSchema.optional() });
export const ticketPackageSchema = z.object({ attractionId: uuidSchema, name: stringRequired, revenueCategoryId: uuidSchema, packagePrice: positiveMoneySchema, maxVisitors: positiveIntSchema.optional(), startsOn: dateSchema.optional(), endsOn: dateSchema.optional() });
export const parkingServiceSchema = z.object({ attractionId: uuidSchema, name: stringRequired, revenueCategoryId: uuidSchema, dailyPrice: positiveMoneySchema, weekendPrice: nonNegativeMoneySchema.optional() });
export const rentalServiceSchema = z.object({ attractionId: uuidSchema, name: stringRequired, type: rentalTypeEnum, revenueCategoryId: uuidSchema, dailyPrice: positiveMoneySchema, weekendPrice: nonNegativeMoneySchema.optional(), seasonalPrice: nonNegativeMoneySchema.optional(), seasonalStartsOn: dateSchema.optional(), seasonalEndsOn: dateSchema.optional() });
export const tenantRentalSchema = z.object({ attractionId: uuidSchema, tenantName: stringRequired, revenueCategoryId: uuidSchema, rentalPrice: positiveMoneySchema });
export const visitorTransactionSchema = z.object({ source: visitorSourceEnum, transactionDate: dateSchema, attractionId: uuidSchema, ticketTypeId: optionalUuidSchema, ticketPackageId: optionalUuidSchema, parkingServiceId: optionalUuidSchema, rentalServiceId: optionalUuidSchema, tenantRentalId: optionalUuidSchema, cashAccountId: uuidSchema, quantity: positiveIntSchema.optional(), visitorCount: positiveIntSchema.optional(), bookingReference: optionalString });
export const validateTicketSchema = z.object({ validationCode: stringRequired });
export const voidVisitorTransactionSchema = z.object({ visitorTransactionId: uuidSchema, reason: z.string().min(10, "Void reason must be at least 10 characters") });

export const installmentPlanSchema = z.object({
  customerId: uuidSchema,
  description: stringRequired,
  totalAmount: positiveMoneySchema,
  downPayment: nonNegativeMoneySchema.optional(),
  tenor: z.coerce.number().int().min(1).max(120),
  startDate: dateSchema,
  arAccountId: uuidSchema,
  revenueAccountId: optionalUuidSchema,
  dpCashAccountId: optionalUuidSchema,
  salesOrderId: optionalUuidSchema,
});

export const installmentPaySchema = z.object({
  scheduleId: uuidSchema,
  cashAccountId: uuidSchema,
  amount: positiveMoneySchema,
  paymentDate: dateSchema,
});
