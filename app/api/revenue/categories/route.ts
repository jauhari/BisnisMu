import { handleApi } from "@/presentation/api/route-handler";
import { revenueCategorySchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";

export async function POST(request: Request) {
  return handleApi(async () => serverServices.revenue.createCategory(await validatedBody(request, revenueCategorySchema) as any));
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.revenueCategory.findMany({ where: { businessId }, orderBy: { name: "asc" } });
  });
}
