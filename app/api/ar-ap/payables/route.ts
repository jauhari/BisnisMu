import { handleApi } from "@/presentation/api/route-handler";
import { PrismaClient } from "@prisma/client";
import { requireTenantContext } from "@/presentation/auth/session";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.bill.findMany({
      where: { businessId, status: { in: ["POSTED", "PARTIALLY_PAID"] } },
      orderBy: { dueDate: "asc" }
    });
  });
}
