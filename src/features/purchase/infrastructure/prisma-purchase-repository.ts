import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot } from "../../accounting/domain/accounting-types";
import { ProductEntity } from "../../inventory/domain/inventory-types";
import { CreateReceiptRecord, CreateReturnRecord, PurchaseAuditEvent, PurchaseRepository } from "../application/purchase-repository";
import { CreatePurchaseOrderInput, PurchaseOrderEntity, PurchaseOrderItemEntity, PurchaseReceiptEntity, PurchaseReturnEntity, SupplierSnapshot, TenantContext } from "../domain/purchase-types";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSupplier(ctx: TenantContext, supplierId: string): Promise<SupplierSnapshot | null> {
    const row = await this.prisma.vendor.findFirst({ where: { businessId: ctx.businessId, id: supplierId } });
    return row ? { id: row.id, businessId: row.businessId, name: row.name, isActive: row.isActive } : null;
  }

  async findProducts(ctx: TenantContext, productIds: string[]): Promise<ProductEntity[]> {
    if (productIds.length === 0) return [];
    const rows = await this.prisma.product.findMany({ where: { businessId: ctx.businessId, id: { in: productIds } } });
    return rows.map((row) => ({
      id: row.id, businessId: row.businessId, type: row.type, sku: row.sku, barcode: row.barcode,
      name: row.name, description: row.description, categoryId: row.categoryId,
      inventoryAccountId: row.inventoryAccountId, cogsAccountId: row.cogsAccountId,
      revenueAccountId: row.revenueAccountId, trackStock: row.trackStock, isActive: row.isActive
    }));
  }

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    if (accountIds.length === 0) return [];
    const rows = await this.prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } });
    return rows.map((account) => ({
      id: account.id, businessId: account.businessId, code: account.code, name: account.name,
      groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode,
      normalBalance: account.normalBalance, subtype: account.subtype,
      isPostingAllowed: account.isPostingAllowed, isActive: account.isActive
    }));
  }

  async nextOrderNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "PO-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.purchaseOrder.findFirst({
      where: { businessId: ctx.businessId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" }
    });
    const next = latest ? Number(latest.orderNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async nextReceiptNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "PR-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.purchaseReceipt.findFirst({
      where: { businessId: ctx.businessId, receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" }
    });
    const next = latest ? Number(latest.receiptNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async nextReturnNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "RT-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.purchaseReturn.findFirst({
      where: { businessId: ctx.businessId, returnNumber: { startsWith: prefix } },
      orderBy: { returnNumber: "desc" }
    });
    const next = latest ? Number(latest.returnNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async createPurchaseOrder(
    ctx: TenantContext,
    input: CreatePurchaseOrderInput,
    totals: { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint },
    orderNumber: string
  ): Promise<PurchaseOrderEntity> {
    const row = await this.prisma.purchaseOrder.create({
      data: {
        businessId: ctx.businessId,
        orderNumber,
        supplierId: input.supplierId,
        orderDate: input.orderDate,
        expectedDate: input.expectedDate ?? null,
        status: "DRAFT",
        notes: input.notes ?? null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        totalAmount: totals.totalAmount,
        grniAccountId: input.grniAccountId,
        apAccountId: input.apAccountId,
        createdByUserId: ctx.actorUserId,
        items: {
          create: input.items.map((item) => ({
            businessId: ctx.businessId,
            productId: item.productId,
            description: item.description ?? null,
            quantity: item.quantity,
            receivedQuantity: 0n,
            unitCost: item.unitCost,
            discountAmount: item.discountAmount ?? 0n,
            taxAmount: item.taxAmount ?? 0n,
            lineTotal: item.quantity * item.unitCost - (item.discountAmount ?? 0n) + (item.taxAmount ?? 0n)
          }))
        }
      },
      include: { items: true }
    });
    return this.toOrder(row);
  }

  async findPurchaseOrder(ctx: TenantContext, purchaseOrderId: string): Promise<PurchaseOrderEntity | null> {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { businessId: ctx.businessId, id: purchaseOrderId },
      include: { items: true }
    });
    return row ? this.toOrder(row) : null;
  }

  async updatePurchaseOrderStatus(ctx: TenantContext, purchaseOrderId: string, status: PurchaseOrderEntity["status"]): Promise<PurchaseOrderEntity> {
    const row = await this.prisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status },
      include: { items: true }
    });
    return this.toOrder(row);
  }

  async updateItemReceived(ctx: TenantContext, itemId: string, receivedQuantity: bigint): Promise<PurchaseOrderItemEntity> {
    const row = await this.prisma.purchaseOrderItem.update({
      where: { id: itemId },
      data: { receivedQuantity }
    });
    return this.toItem(row);
  }

  async createReceipt(ctx: TenantContext, input: CreateReceiptRecord): Promise<PurchaseReceiptEntity> {
    const row = await this.prisma.purchaseReceipt.create({
      data: {
        businessId: ctx.businessId,
        purchaseOrderId: input.purchaseOrderId,
        receiptNumber: input.receiptNumber,
        receiptDate: input.receiptDate,
        totalCost: input.totalCost,
        postedJournalId: input.postedJournalId,
        createdByUserId: ctx.actorUserId
      }
    });
    return this.toReceipt(row);
  }

  async createReturn(ctx: TenantContext, input: CreateReturnRecord): Promise<PurchaseReturnEntity> {
    const row = await this.prisma.purchaseReturn.create({
      data: {
        businessId: ctx.businessId,
        purchaseOrderId: input.purchaseOrderId,
        returnNumber: input.returnNumber,
        returnDate: input.returnDate,
        totalCost: input.totalCost,
        postedJournalId: input.postedJournalId,
        createdByUserId: ctx.actorUserId
      }
    });
    return this.toReturn(row);
  }

  async createAuditLog(ctx: TenantContext, event: PurchaseAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        action: event.action as any,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        metadata: event.metadata as Prisma.InputJsonValue,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null
      }
    });
  }

  private toOrder(row: any): PurchaseOrderEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      orderNumber: row.orderNumber,
      supplierId: row.supplierId,
      orderDate: row.orderDate,
      expectedDate: row.expectedDate,
      status: row.status,
      notes: row.notes,
      subtotal: row.subtotal,
      discountTotal: row.discountTotal,
      taxTotal: row.taxTotal,
      totalAmount: row.totalAmount,
      grniAccountId: row.grniAccountId,
      apAccountId: row.apAccountId,
      createdByUserId: row.createdByUserId,
      items: row.items.map((item: any) => this.toItem(item))
    };
  }

  private toItem(row: any): PurchaseOrderItemEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      purchaseOrderId: row.purchaseOrderId,
      productId: row.productId,
      description: row.description,
      quantity: row.quantity,
      receivedQuantity: row.receivedQuantity,
      unitCost: row.unitCost,
      discountAmount: row.discountAmount,
      taxAmount: row.taxAmount,
      lineTotal: row.lineTotal
    };
  }

  private toReceipt(row: any): PurchaseReceiptEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      purchaseOrderId: row.purchaseOrderId,
      receiptNumber: row.receiptNumber,
      receiptDate: row.receiptDate,
      totalCost: row.totalCost,
      postedJournalId: row.postedJournalId,
      createdByUserId: row.createdByUserId
    };
  }

  private toReturn(row: any): PurchaseReturnEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      purchaseOrderId: row.purchaseOrderId,
      returnNumber: row.returnNumber,
      returnDate: row.returnDate,
      totalCost: row.totalCost,
      postedJournalId: row.postedJournalId,
      createdByUserId: row.createdByUserId
    };
  }
}
