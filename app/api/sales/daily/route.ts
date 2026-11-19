import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { createDailySale } from "@/presentation/sales/create-daily-sale";
import { z } from "zod";

const dailySaleSchema = z.object({
  saleDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  cashAccountId: z.string().min(1),
  description:  z.string().optional(),
  items: z.array(z.object({
    revenueAccountId: z.string().min(1),
    description:      z.string().optional(),
    amount:           z.number().int().positive(),
    contacts: z.array(z.object({
      contactId: z.string().min(1),
      amount:    z.number().int().optional(),
      notes:     z.string().optional(),
    })).optional().default([]),
  })).min(1),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const { businessId, actorUserId } = await requireTenantContext(request);
    const body = dailySaleSchema.parse(await request.json());

    return createDailySale({
      businessId,
      actorUserId,
      saleDate: body.saleDate,
      cashAccountId: body.cashAccountId,
      description: body.description,
      items: body.items,
    });
  });
}