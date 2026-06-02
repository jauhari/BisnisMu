import { handleApi } from "@/presentation/api/route-handler";
import { attractionSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";

export async function POST(request: Request) {
  return handleApi(async () => serverServices.tourism.createAttraction(await validatedBody(request, attractionSchema) as any));
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.attraction.findMany({ where: { businessId }, orderBy: { name: "asc" } });
  });
}
