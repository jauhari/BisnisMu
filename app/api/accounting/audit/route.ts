import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { requireTenantContext } from "@/presentation/auth/session";


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
