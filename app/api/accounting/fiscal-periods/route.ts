import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { fiscalPeriodSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";


export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.fiscalPeriod.findMany({ where: { businessId }, orderBy: { fiscalYear: "desc" } });
  });
}

export async function POST(request: Request) { return handleApi(async () => serverServices.business.openFiscalPeriod(await validatedBody(request, fiscalPeriodSchema) as any)); }
