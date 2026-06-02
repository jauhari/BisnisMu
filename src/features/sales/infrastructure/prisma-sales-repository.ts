import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { ProductEntity, ProductPriceEntity, ProviderProductEntity } from "../../inventory/domain/inventory-types";
import { SalesAuditEvent, SalesRepository } from "../application/sales-repository";
import { CustomerSnapshot, SalesOrderEntity, SalesOrderItemEntity, SalesStatus, TenantContext } from "../domain/sales-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaSalesRepository implements SalesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCustomer(ctx: TenantContext, customerId: string): Promise<CustomerSnapshot | null> {
    const row = await this.prisma.customer.findFirst({ where: { businessId: ctx.businessId, id: customerId } });
    return row ? { id: row.id, businessId: row.businessId, name: row.name, isActive: row.isActive } : null;
  }

  async findProducts(ctx: TenantContext, productIds: string[]): Promise<ProductEntity[]> {
    const rows = await this.prisma.product.findMany({ where: { businessId: ctx.businessId, id: { in: productIds } } });
    return rows.map((row) => ({ id: row.id, businessId: row.businessId, type: row.type, sku: row.sku, barcode: row.barcode, name: row.name, description: row.description, categoryId: row.categoryId, inventoryAccountId: row.inventoryAccountId, cogsAccountId: row.cogsAccountId, revenueAccountId: row.revenueAccountId, trackStock: row.trackStock, isActive: row.isActive }));
  }

  async findPrices(ctx: TenantContext, productIds: string[], asOf: Date): Promise<ProductPriceEntity[]> {
    const rows = await this.prisma.productPrice.findMany({ where: { businessId: ctx.businessId, productId: { in: productIds }, effectiveDate: { lte: asOf }, isActive: true } });
    return rows.map((row) => ({ id: row.id, businessId: row.businessId, productId: row.productId, priceType: row.priceType, amount: row.amount, effectiveDate: row.effectiveDate, priority: row.priority, isActive: row.isActive }));
  }

  async findProviderProducts(ctx: TenantContext, productIds: string[]): Promise<ProviderProductEntity[]> {
    const rows = await this.prisma.providerProduct.findMany({ where: { businessId: ctx.businessId, productId: { in: productIds }, isActive: true } });
    return rows.map((row) => ({ id: row.id, businessId: row.businessId, productId: row.productId, provider: row.provider, providerSku: row.providerCode, floatAccountId: row.floatAccountId, dynamicBuyPrice: row.providerBuyPrice, dynamicSellPrice: row.providerSellPrice, isActive: row.isActive }));
  }

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    const rows = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return rows.map((account) => ({ id: account.id, businessId: account.businessId, code: account.code, name: account.name, groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode, normalBalance: account.normalBalance, subtype: account.subtype, isPostingAllowed: account.isPostingAllowed, isActive: account.isActive }));
  }

  async nextSalesNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "SO-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.salesOrder.findFirst({ where: { businessId: ctx.businessId, salesNumber: { startsWith: prefix } }, orderBy: { salesNumber: "desc" } });
    const next = latest ? Number(latest.salesNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async createSalesOrder(ctx: TenantContext, input: any, computed: any, salesNumber: string): Promise<SalesOrderEntity> {
    const row = await this.prisma.salesOrder.create({
      data: {
        businessId: ctx.businessId,
        salesNumber,
        customerId: input.customerId,
        saleDate: input.saleDate,
        status: "DRAFT",
        description: input.description,
        subtotal: computed.subtotal,
        discountTotal: computed.discountTotal,
        taxTotal: computed.taxTotal,
        totalAmount: computed.totalAmount,
        paidAmount: 0n,
        revenueSettlementAccountId: input.revenueSettlementAccountId,
        arAccountId: input.arAccountId ?? null,
        createdByUserId: ctx.actorUserId,
        items: {
          create: computed.items.map((item: any) => ({
            businessId: ctx.businessId,
            productId: item.productId,
            productType: item.productType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
            locationId: item.locationId ?? null,
            providerProductId: item.providerProductId ?? null
          }))
        }
      },
      include: { items: true }
    });
    return this.toSalesOrder(row);
  }

  async findSalesOrder(ctx: TenantContext, salesOrderId: string): Promise<SalesOrderEntity | null> {
    const row = await this.prisma.salesOrder.findFirst({ where: { businessId: ctx.businessId, id: salesOrderId }, include: { items: true } });
    return row ? this.toSalesOrder(row) : null;
  }

  async listSalesOrders(ctx: TenantContext, input: { search?: string; sortBy?: "saleDate" | "salesNumber" | "totalAmount"; sortOrder?: "asc" | "desc"; page?: number; pageSize?: number; }): Promise<{ rows: SalesOrderEntity[]; total: number }> {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 25;
    const where: Prisma.SalesOrderWhereInput = { businessId: ctx.businessId };
    if (input.search && input.search.trim()) {
      where.OR = [
        { salesNumber: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } },
        { customer: { name: { contains: input.search, mode: "insensitive" } } }
      ];
    }
    const orderBy = { [input.sortBy ?? "saleDate"]: input.sortOrder ?? "desc" } as Prisma.SalesOrderOrderByWithRelationInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.salesOrder.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: { items: true } }),
      this.prisma.salesOrder.count({ where })
    ]);
    return { rows: rows.map((row) => this.toSalesOrder(row)), total };
  }

  async updateSalesStatus(ctx: TenantContext, salesOrderId: string, status: SalesStatus, paidAmount?: bigint, paymentTransactionId?: string, postedJournalId?: string): Promise<SalesOrderEntity> {
    const data: Record<string, unknown> = { status };
    if (paidAmount !== undefined) data.paidAmount = paidAmount;
    if (paymentTransactionId !== undefined) data.paymentTransactionId = paymentTransactionId;
    if (postedJournalId !== undefined) data.postedJournalId = postedJournalId;
    const row = await this.prisma.salesOrder.update({ where: { id: salesOrderId }, data, include: { items: true } });
    return this.toSalesOrder(row);
  }

  async createAuditLog(ctx: TenantContext, event: SalesAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: { businessId: ctx.businessId, actorUserId: ctx.actorUserId, action: event.action as any, entityType: event.entityType, entityId: event.entityId ?? null, metadata: event.metadata as Prisma.InputJsonValue, requestId: ctx.requestId ?? null, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null } });
  }

  private toSalesOrder(row: any): SalesOrderEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      salesNumber: row.salesNumber,
      customerId: row.customerId,
      saleDate: row.saleDate,
      status: row.status,
      description: row.description,
      subtotal: row.subtotal,
      discountTotal: row.discountTotal,
      taxTotal: row.taxTotal,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      revenueSettlementAccountId: row.revenueSettlementAccountId,
      arAccountId: row.arAccountId,
      paymentTransactionId: row.paymentTransactionId,
      postedJournalId: row.postedJournalId,
      createdByUserId: row.createdByUserId,
      items: row.items.map((item: any): SalesOrderItemEntity => ({ id: item.id, businessId: item.businessId, salesOrderId: item.salesOrderId, productId: item.productId, productType: item.productType, quantity: item.quantity, unitPrice: item.unitPrice, discountAmount: item.discountAmount, taxAmount: item.taxAmount, lineTotal: item.lineTotal, locationId: item.locationId, providerProductId: item.providerProductId }))
    };
  }
}
