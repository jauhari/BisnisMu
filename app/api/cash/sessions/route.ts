import { handleApi } from "@/presentation/api/route-handler";
import { cashSessionOpenSchema, cashSessionCloseSchema } from "@/presentation/api/request-schemas";
import { validatedBody, parseAndValidate } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";

export async function POST(request: Request) {
  const cloned = request.clone();
  const peek = await cloned.json() as Record<string, unknown>;
  if (peek.sessionId) {
    return handleApi(async () => serverServices.cashSession.closeSession(await validatedBody(request, cashSessionCloseSchema) as any));
  }
  return handleApi(async () => serverServices.cashSession.openSession(await validatedBody(request, cashSessionOpenSchema) as any));
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.cashSessionRecord.findMany({ where: { businessId }, orderBy: { openedAt: "desc" }, take: 50 });
  });
}
