import { handleApi } from "@/presentation/api/route-handler";
import { settingsSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { prisma } from "@/presentation/api/prisma";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { id: true, name: true, type: true, fiscalYearStart: true, npwpNumber: true, address: true, currency: true, settings: true },
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => serverServices.business.updateSettings(await validatedBody(request, settingsSchema) as any));
}
