import { unstable_cache } from "next/cache";

import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { fiscalPeriodSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

const getCachedFiscalPeriods = unstable_cache(
  async (businessId: string) => prisma.fiscalPeriod.findMany({ where: { businessId }, orderBy: { fiscalYear: "desc" } }),
  ["fiscal-periods"],
  { revalidate: 300 }
);

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return getCachedFiscalPeriods(businessId);
  });
}

export async function POST(request: Request) { return handleApi(async () => serverServices.business.openFiscalPeriod(await validatedBody(request, fiscalPeriodSchema) as any)); }
