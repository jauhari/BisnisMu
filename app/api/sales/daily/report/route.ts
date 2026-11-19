import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { serverServices } from "@/presentation/api/server-services";
import { createDailySale } from "@/presentation/sales/create-daily-sale";
import { z } from "zod";

const reportSchema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  cashAccountId: z.string().min(1),
  description: z.string().optional(),
  incomeItems: z.array(z.object({
    revenueAccountId: z.string().min(1),
    description: z.string().optional(),
    amount: z.number().int().positive(),
    contacts: z.array(z.object({
      contactId: z.string().min(1),
      amount: z.number().int().optional(),
      notes: z.string().optional(),
    })).optional().default([]),
  })).default([]),
  expenseItems: z.array(z.object({
    categoryAccountId: z.string().min(1),
    description: z.string().min(1),
    amount: z.number().int().positive(),
  })).default([]),
}).refine(
  (body) => body.incomeItems.length > 0 || body.expenseItems.length > 0,
  { message: "Minimal satu item pemasukan atau pengeluaran." }
);

export async function POST(request: Request) {
  return handleApi(async () => {
    const tenant = await requireTenantContext(request);
    const body = reportSchema.parse(await request.json());
    const txDate = new Date(body.saleDate);

    let income: Awaited<ReturnType<typeof createDailySale>> | null = null;
    if (body.incomeItems.length > 0) {
      income = await createDailySale({
        businessId: tenant.businessId,
        actorUserId: tenant.actorUserId,
        saleDate: body.saleDate,
        cashAccountId: body.cashAccountId,
        description: body.description ?? `Laporan Harian ${body.saleDate}`,
        items: body.incomeItems,
      });
    }

    const expenses = [];
    for (const item of body.expenseItems) {
      const draft = await serverServices.cashManagement.createDraft({
        businessId: tenant.businessId,
        actorUserId: tenant.actorUserId,
        type: "CASH_OUT",
        transactionDate: txDate,
        cashAccountId: body.cashAccountId,
        categoryAccountId: item.categoryAccountId,
        amount: BigInt(item.amount),
        description: item.description,
      });
      const posted = await serverServices.cashManagement.post({
        businessId: tenant.businessId,
        actorUserId: tenant.actorUserId,
        transactionId: draft.id,
      });
      expenses.push({
        transactionId: posted.transaction.id,
        journalNumber: posted.journal.journalNumber,
      });
    }

    return {
      income,
      expenses,
      journalNumbers: [
        ...(income ? [income.journalNumber] : []),
        ...expenses.map((e) => e.journalNumber),
      ],
    };
  });
}