import { handleApi } from "@/presentation/api/route-handler";
import { PrismaPurchaseRepository } from "@/features/purchase/infrastructure/prisma-purchase-repository";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const repo = new PrismaPurchaseRepository(prisma);

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId, actorUserId } = await requireTenantContext(request);
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    if (orderId) {
      return repo.findPurchaseOrder({ businessId, actorUserId }, orderId);
    }
    const orders = await prisma.purchaseOrder.findMany({
      where: { businessId },
      include: { items: true },
      orderBy: { orderDate: "desc" }
    });
    return orders;
  });
}
