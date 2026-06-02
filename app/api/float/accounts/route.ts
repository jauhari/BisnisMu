import { handleApi } from "@/presentation/api/route-handler";
import { floatAccountSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { PrismaClient } from "@prisma/client";
import { requireTenantContext } from "@/presentation/auth/session";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.floatAccount.findMany({ where: { businessId }, orderBy: { name: "asc" } });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => serverServices.float.createFloatAccount(await validatedBody(request, floatAccountSchema) as any));
}
