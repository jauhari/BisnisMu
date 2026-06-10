import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { requireTenantContext } from "@/presentation/auth/session";
import { serverServices } from "@/presentation/api/server-services";
import { z } from "zod";


const schema = z.object({
  sessionId: z.string().uuid(),
  reconciledAt: z.coerce.date(),
  countedAmount: z.coerce.bigint().nonnegative(),
  differenceAccountId: z.string().uuid(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.cashReconciliationRecord.findMany({
      where: { businessId },
      orderBy: { reconciledAt: "desc" },
      take: 50
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const ctx = await requireTenantContext(request);
    const body = schema.parse(await request.json());
    return serverServices.cashSession.reconcileCash({ ...ctx, ...body } as any);
  });
}
