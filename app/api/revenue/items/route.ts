import { handleApi } from "@/presentation/api/route-handler";
import { revenueItemSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";

export async function POST(request: Request) {
  return handleApi(async () => serverServices.revenue.createItem(await validatedBody(request, revenueItemSchema) as any));
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.revenueItem.findMany({ where: { businessId }, orderBy: { name: "asc" } });
  });
}
