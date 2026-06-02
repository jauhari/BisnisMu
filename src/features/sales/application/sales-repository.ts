import { AccountSnapshot } from "../../accounting/domain/accounting-types";
import { ProductEntity, ProductPriceEntity, ProviderProductEntity } from "../../inventory/domain/inventory-types";
import { CustomerSnapshot, CreateSalesOrderInput, SalesOrderEntity, SalesStatus, TenantContext } from "../domain/sales-types";

export interface SalesAuditEvent { action: "SALES_ORDER_CREATED" | "SALES_ORDER_CONFIRMED" | "SALES_PAYMENT_ALLOCATED" | "SALES_ORDER_VOIDED"; businessId: string; actorUserId: string; entityType: "sales_order"; entityId?: string; metadata: Record<string, unknown>; }
export interface SalesRepository {
  findCustomer(ctx: TenantContext, customerId: string): Promise<CustomerSnapshot | null>;
  findProducts(ctx: TenantContext, productIds: string[]): Promise<ProductEntity[]>;
  findPrices(ctx: TenantContext, productIds: string[], asOf: Date): Promise<ProductPriceEntity[]>;
  findProviderProducts(ctx: TenantContext, productIds: string[]): Promise<ProviderProductEntity[]>;
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  nextSalesNumber(ctx: TenantContext, date: Date): Promise<string>;
  createSalesOrder(ctx: TenantContext, input: CreateSalesOrderInput, computed: { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint; items: Array<{ businessId: string; productId: string; productType: "PHYSICAL" | "DIGITAL" | "SERVICE"; quantity: bigint; unitPrice: bigint; discountAmount: bigint; taxAmount: bigint; lineTotal: bigint; locationId?: string | null; providerProductId?: string | null }> }, salesNumber: string): Promise<SalesOrderEntity>;
  findSalesOrder(ctx: TenantContext, salesOrderId: string): Promise<SalesOrderEntity | null>;
  listSalesOrders(ctx: TenantContext, input: { search?: string; sortBy?: "saleDate" | "salesNumber" | "totalAmount"; sortOrder?: "asc" | "desc"; page?: number; pageSize?: number; }): Promise<{ rows: SalesOrderEntity[]; total: number }>;
  updateSalesStatus(ctx: TenantContext, salesOrderId: string, status: SalesStatus, paidAmount?: bigint, paymentTransactionId?: string, postedJournalId?: string): Promise<SalesOrderEntity>;
  createAuditLog(ctx: TenantContext, event: SalesAuditEvent): Promise<void>;
}
export interface Meta { actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface CreateSalesOrderCommand extends CreateSalesOrderInput, Meta {}
export interface ConfirmSalesOrderCommand { businessId: string; salesOrderId: string; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
export interface AllocateSalesPaymentCommand { businessId: string; salesOrderId: string; allocations: CreateSalesOrderInput["allocations"]; actorUserId: string; requestId?: string; ipAddress?: string; userAgent?: string; }
