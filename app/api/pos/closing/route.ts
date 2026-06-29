import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { PrismaClient } = await import("@prisma/client");
        const { businessId } = await requireTenantContext(request);
    return prisma.posSessionRecord.findMany({
      where: { businessId, status: "CLOSED" },
      orderBy: { closedAt: "desc" }
    });
  });
}
