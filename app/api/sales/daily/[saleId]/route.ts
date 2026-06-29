import { z } from "zod";

import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { parseAndValidate } from "@/presentation/api/validation";
import { reversePostedJournal } from "@/presentation/accounting/journal-workflows";
import { AuthError } from "@/presentation/auth/auth-error";
import { canHardMutateOrganizationTransaction, canReadTransaction, canVoidPostedTransaction, organizationHardMutationEnabled } from "@/presentation/auth/permissions";
import { requireTenantContext } from "@/presentation/auth/session";

const voidSchema = z.object({ reason: z.string().min(10).optional() }).optional();
const dailySalePatchSchema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  cashAccountId: z.string().min(1),
  description: z.string().optional(),
  items: z.array(z.object({
    revenueAccountId: z.string().min(1),
    description: z.string().optional(),
    amount: z.number().int().positive(),
    contacts: z.array(z.object({
      contactId: z.string().min(1),
      amount: z.number().int().optional(),
      notes: z.string().optional(),
    })).optional().default([]),
  })).min(1),
});

export async function GET(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  return handleApi(async () => {
    const [{ saleId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    if (!canReadTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    const sale = await prisma.dailySale.findFirst({
      where: { id: saleId, businessId: tenant.businessId },
      include: {
        cashAccount: { select: { code: true, name: true } },
        items: {
          include: {
            revenueAccount: { select: { code: true, name: true } },
            contacts: { include: { contact: { select: { id: true, name: true, category: true, phone: true } } } },
          },
          orderBy: { lineNo: "asc" },
        },
      },
    });
    if (!sale) throw new Error("Daily sale was not found.");
    return sale;
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  return handleApi(async () => {
    const [{ saleId }, tenant, body] = await Promise.all([params, requireTenantContext(request), parseAndValidate(request, voidSchema).catch(() => undefined)]);
    const business = await prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } });
    const sale = await prisma.dailySale.findFirst({ where: { id: saleId, businessId: tenant.businessId } });
    if (!sale) throw new Error("Daily sale was not found.");
    if (canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings))) {
      await prisma.$transaction(async (tx) => {
        if (sale.journalId) {
          await tx.journalLine.deleteMany({ where: { businessId: tenant.businessId, journalId: sale.journalId } });
          await tx.journalEntry.delete({ where: { id: sale.journalId } });
        }
        if (sale.voidJournalId) {
          await tx.journalLine.deleteMany({ where: { businessId: tenant.businessId, journalId: sale.voidJournalId } });
          await tx.journalEntry.delete({ where: { id: sale.voidJournalId } });
        }
        await tx.dailySale.delete({ where: { id: sale.id } });
        await tx.auditLog.create({ data: { businessId: tenant.businessId, actorUserId: tenant.actorUserId, action: "SALES_ORDER_VOIDED", entityType: "daily_sale", entityId: sale.id, metadata: { previousStatus: sale.status, journalId: sale.journalId, hardDelete: true } } });
      });
      return { deleted: true, sale };
    }
    if (!canVoidPostedTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    if (sale.status === "VOID") throw new Error("Daily sale already voided.");
    if (!sale.journalId) {
      await prisma.dailySale.delete({ where: { id: sale.id } });
      return { deleted: true };
    }
    const reversal = await reversePostedJournal(prisma, { businessId: tenant.businessId, actorUserId: tenant.actorUserId }, sale.journalId);
    const updated = await prisma.dailySale.update({
      where: { id: sale.id },
      data: {
        status: "VOID",
        voidJournalId: reversal.id,
        voidReason: body?.reason ?? "Void daily sale",
        voidedByUserId: tenant.actorUserId,
        voidedAt: new Date(),
      },
    });
    return { sale: updated, reversal };
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ saleId: string }> }) {
  return handleApi(async () => {
    const [{ saleId }, tenant, body] = await Promise.all([params, requireTenantContext(request), parseAndValidate(request, dailySalePatchSchema)]);
    const business = await prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } });
    if (!canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings))) throw new AuthError("FORBIDDEN", "Forbidden");
    const existing = await prisma.dailySale.findFirst({ where: { id: saleId, businessId: tenant.businessId } });
    if (!existing) throw new Error("Daily sale was not found.");
    const totalAmount = BigInt(body.items.reduce((sum, item) => sum + item.amount, 0));
    const saleDate = new Date(body.saleDate);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.dailySaleItem.deleteMany({ where: { dailySaleId: saleId } });
      const sale = await tx.dailySale.update({
        where: { id: saleId },
        data: {
          saleDate,
          cashAccountId: body.cashAccountId,
          description: body.description ?? null,
          totalAmount,
          items: {
            create: body.items.map((item, index) => ({
              revenueAccountId: item.revenueAccountId,
              description: item.description ?? null,
              amount: BigInt(item.amount),
              lineNo: index + 1,
              contacts: item.contacts.length ? { create: item.contacts.map((contact) => ({ contactId: contact.contactId, amount: contact.amount != null ? BigInt(contact.amount) : null, notes: contact.notes ?? null })) } : undefined,
            })) as any,
          },
        },
        include: { items: { include: { contacts: true } } },
      });
      if (existing.journalId) {
        await tx.journalLine.deleteMany({ where: { businessId: tenant.businessId, journalId: existing.journalId } });
        await tx.journalEntry.update({
          where: { id: existing.journalId },
          data: {
            transactionDate: saleDate,
            source: "DAILY_SALE",
            sourceId: saleId,
            description: body.description ?? `Penjualan ${body.saleDate}`,
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            lines: {
              create: [
                { businessId: tenant.businessId, accountId: body.cashAccountId, side: "DEBIT", amount: totalAmount, lineNo: 1 },
                ...body.items.map((item, index) => ({ businessId: tenant.businessId, accountId: item.revenueAccountId, side: "CREDIT" as const, amount: BigInt(item.amount), memo: item.description ?? null, lineNo: index + 2 })),
              ],
            },
          },
        });
      }
      await tx.auditLog.create({ data: { businessId: tenant.businessId, actorUserId: tenant.actorUserId, action: "SALES_ORDER_UPDATED", entityType: "daily_sale", entityId: saleId, metadata: { previousStatus: existing.status, journalId: existing.journalId, hardEdit: true, totalAmount: totalAmount.toString() } } });
      return sale;
    });
    return updated;
  });
}
