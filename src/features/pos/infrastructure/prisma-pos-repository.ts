import { Prisma, PrismaClient } from "@prisma/client";
import { ProductEntity } from "../../inventory/domain/inventory-types";
import { PosAuditEvent, PosRepository } from "../application/pos-repository";
import {
  AddCartItemInput,
  PosCartItemEntity,
  PosReceiptEntity,
  PosSessionEntity,
  PosTerminalEntity,
  PosTransactionEntity,
  PosTransactionStatus,
  TenantContext
} from "../domain/pos-types";

export class PrismaPosRepository implements PosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTerminal(ctx: TenantContext, terminalId: string): Promise<PosTerminalEntity | null> {
    const row = await this.prisma.posTerminal.findFirst({ where: { businessId: ctx.businessId, id: terminalId } });
    return row ? { id: row.id, businessId: row.businessId, name: row.name, cashDrawerId: row.cashDrawerId, isActive: row.isActive } : null;
  }

  async findOpenSessionByTerminal(ctx: TenantContext, terminalId: string): Promise<PosSessionEntity | null> {
    const row = await this.prisma.posSessionRecord.findFirst({
      where: { businessId: ctx.businessId, terminalId, status: "OPEN" }
    });
    return row ? this.toSession(row) : null;
  }

  async createSession(ctx: TenantContext, input: { terminalId: string; openedAt: Date; openingAmount: bigint; shiftCode?: string; cashSessionId?: string | null }): Promise<PosSessionEntity> {
    const row = await this.prisma.posSessionRecord.create({
      data: {
        businessId: ctx.businessId,
        terminalId: input.terminalId,
        cashSessionId: input.cashSessionId ?? null,
        status: "OPEN",
        openedAt: input.openedAt,
        openingAmount: input.openingAmount,
        expectedClosingAmount: input.openingAmount,
        openedByUserId: ctx.actorUserId,
        shiftCode: input.shiftCode ?? null
      }
    });
    return this.toSession(row);
  }

  async findSession(ctx: TenantContext, sessionId: string): Promise<PosSessionEntity | null> {
    const row = await this.prisma.posSessionRecord.findFirst({
      where: { businessId: ctx.businessId, id: sessionId }
    });
    return row ? this.toSession(row) : null;
  }

  async closeSession(ctx: TenantContext, sessionId: string, closedAt: Date, countedAmount: bigint, differenceAmount: bigint): Promise<PosSessionEntity> {
    const row = await this.prisma.posSessionRecord.update({
      where: { id: sessionId },
      data: {
        status: "CLOSED",
        closedAt,
        countedClosingAmount: countedAmount,
        differenceAmount,
        closedByUserId: ctx.actorUserId
      }
    });
    return this.toSession(row);
  }

  async findProductByBarcode(ctx: TenantContext, barcode: string): Promise<ProductEntity | null> {
    const row = await this.prisma.product.findFirst({ where: { businessId: ctx.businessId, barcode } });
    return row ? this.toProduct(row) : null;
  }

  async findProduct(ctx: TenantContext, productId: string): Promise<ProductEntity | null> {
    const row = await this.prisma.product.findFirst({ where: { businessId: ctx.businessId, id: productId } });
    return row ? this.toProduct(row) : null;
  }

  async nextTransactionNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "POS-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.posTransactionRecord.findFirst({
      where: { businessId: ctx.businessId, transactionNumber: { startsWith: prefix } },
      orderBy: { transactionNumber: "desc" }
    });
    const next = latest ? Number(latest.transactionNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async findTransaction(ctx: TenantContext, transactionId: string): Promise<PosTransactionEntity | null> {
    const row = await this.prisma.posTransactionRecord.findFirst({
      where: { businessId: ctx.businessId, id: transactionId },
      include: { items: true }
    });
    return row ? this.toTransaction(row) : null;
  }

  async createTransaction(ctx: TenantContext, input: { sessionId: string; customerId: string; transactionDate: Date; transactionNumber: string }): Promise<PosTransactionEntity> {
    const row = await this.prisma.posTransactionRecord.create({
      data: {
        businessId: ctx.businessId,
        sessionId: input.sessionId,
        transactionNumber: input.transactionNumber,
        customerId: input.customerId,
        status: "DRAFT",
        transactionDate: input.transactionDate,
        subtotal: 0n,
        discountTotal: 0n,
        taxTotal: 0n,
        totalAmount: 0n,
        paidAmount: 0n,
        changeAmount: 0n,
        createdByUserId: ctx.actorUserId
      },
      include: { items: true }
    });
    return this.toTransaction(row);
  }

  async addCartItem(ctx: TenantContext, transactionId: string, input: AddCartItemInput, productId: string): Promise<PosCartItemEntity> {
    const row = await this.prisma.posCartItem.create({
      data: {
        businessId: ctx.businessId,
        transactionId,
        productId,
        quantity: input.quantity,
        unitPrice: input.unitPrice ?? null,
        priceId: input.priceId ?? null,
        discountAmount: input.discountAmount ?? 0n,
        discountPercentBps: input.discountPercentBps ?? 0n,
        taxAmount: input.taxAmount ?? 0n,
        locationId: input.locationId ?? null,
        providerProductId: input.providerProductId ?? null,
        barcode: input.barcode ?? null
      }
    });
    return this.toCartItem(row);
  }

  async removeCartItem(ctx: TenantContext, transactionId: string, cartItemId: string): Promise<void> {
    await this.prisma.posCartItem.deleteMany({
      where: { id: cartItemId, transactionId, businessId: ctx.businessId }
    });
  }

  async updateTransactionTotals(ctx: TenantContext, transactionId: string, totals: { subtotal: bigint; discountTotal: bigint; taxTotal: bigint; totalAmount: bigint }): Promise<PosTransactionEntity> {
    const row = await this.prisma.posTransactionRecord.update({
      where: { id: transactionId },
      data: { subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxTotal: totals.taxTotal, totalAmount: totals.totalAmount },
      include: { items: true }
    });
    return this.toTransaction(row);
  }

  async updateTransactionStatus(
    ctx: TenantContext,
    transactionId: string,
    status: PosTransactionStatus,
    paidAmount?: bigint,
    changeAmount?: bigint,
    salesOrderId?: string,
    paymentTransactionId?: string,
    receiptId?: string
  ): Promise<PosTransactionEntity> {
    const data: Record<string, unknown> = { status };
    if (paidAmount !== undefined) data.paidAmount = paidAmount;
    if (changeAmount !== undefined) data.changeAmount = changeAmount;
    if (salesOrderId !== undefined) data.salesOrderId = salesOrderId;
    if (paymentTransactionId !== undefined) data.paymentTransactionId = paymentTransactionId;
    if (receiptId !== undefined) data.receiptId = receiptId;
    const row = await this.prisma.posTransactionRecord.update({
      where: { id: transactionId },
      data,
      include: { items: true }
    });
    return this.toTransaction(row);
  }

  async nextReceiptNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = "RCP-" + date.getUTCFullYear() + String(date.getUTCMonth() + 1).padStart(2, "0") + "-";
    const latest = await this.prisma.posReceiptRecord.findFirst({
      where: { businessId: ctx.businessId, receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" }
    });
    const next = latest ? Number(latest.receiptNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(next).padStart(5, "0");
  }

  async createReceipt(ctx: TenantContext, transactionId: string, issuedAt: Date, totalAmount: bigint, paidAmount: bigint, changeAmount: bigint, receiptNumber: string): Promise<PosReceiptEntity> {
    const row = await this.prisma.posReceiptRecord.create({
      data: {
        businessId: ctx.businessId,
        transactionId,
        receiptNumber,
        issuedAt,
        totalAmount,
        paidAmount,
        changeAmount
      }
    });
    return this.toReceipt(row);
  }

  async createAuditLog(ctx: TenantContext, event: PosAuditEvent): Promise<void> {
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

  private toSession(row: any): PosSessionEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      terminalId: row.terminalId,
      cashSessionId: row.cashSessionId,
      status: row.status,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      openingAmount: row.openingAmount,
      expectedClosingAmount: row.expectedClosingAmount,
      countedClosingAmount: row.countedClosingAmount,
      differenceAmount: row.differenceAmount,
      openedByUserId: row.openedByUserId,
      closedByUserId: row.closedByUserId,
      shiftCode: row.shiftCode
    };
  }

  private toProduct(row: any): ProductEntity {
    return {
      id: row.id, businessId: row.businessId, type: row.type, sku: row.sku, barcode: row.barcode,
      name: row.name, description: row.description, categoryId: row.categoryId,
      inventoryAccountId: row.inventoryAccountId, cogsAccountId: row.cogsAccountId,
      revenueAccountId: row.revenueAccountId, trackStock: row.trackStock, isActive: row.isActive
    };
  }

  private toTransaction(row: any): PosTransactionEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      sessionId: row.sessionId,
      transactionNumber: row.transactionNumber,
      customerId: row.customerId,
      status: row.status,
      transactionDate: row.transactionDate,
      subtotal: row.subtotal,
      discountTotal: row.discountTotal,
      taxTotal: row.taxTotal,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      changeAmount: row.changeAmount,
      salesOrderId: row.salesOrderId,
      paymentTransactionId: row.paymentTransactionId,
      receiptId: row.receiptId,
      createdByUserId: row.createdByUserId,
      items: (row.items ?? []).map((item: any) => this.toCartItem(item))
    };
  }

  private toCartItem(row: any): PosCartItemEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      transactionId: row.transactionId,
      productId: row.productId,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      priceId: row.priceId,
      discountAmount: row.discountAmount,
      discountPercentBps: row.discountPercentBps,
      taxAmount: row.taxAmount,
      locationId: row.locationId,
      providerProductId: row.providerProductId,
      barcode: row.barcode
    };
  }

  private toReceipt(row: any): PosReceiptEntity {
    return {
      id: row.id,
      businessId: row.businessId,
      transactionId: row.transactionId,
      receiptNumber: row.receiptNumber,
      issuedAt: row.issuedAt,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      changeAmount: row.changeAmount
    };
  }
}
