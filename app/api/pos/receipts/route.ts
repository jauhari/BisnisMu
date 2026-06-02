import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const { businessId } = await requireTenantContext(request);
    return prisma.posReceiptRecord.findMany({
      where: { businessId },
      orderBy: { issuedAt: "desc" }
    });
  });
}
