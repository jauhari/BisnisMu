import { handleApi } from "@/presentation/api/route-handler";
import { PrismaClient } from "@prisma/client";
import { requireTenantContext } from "@/presentation/auth/session";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.auditLog.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  });
}
