import { handleApi } from "@/presentation/api/route-handler";
import { partySchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { PrismaClient } from "@prisma/client";
import { requireTenantContext } from "@/presentation/auth/session";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.vendor.findMany({ where: { businessId }, orderBy: { name: "asc" } });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => serverServices.arAp.createVendor(await validatedBody(request, partySchema) as any));
}
