import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const rows = await prisma.dailySale.findMany({
      where: { businessId },
      include: {
        cashAccount:  { select: { code: true, name: true } },
        items: {
          include: {
            revenueAccount: { select: { code: true, name: true } },
            contacts: {
              include: { contact: { select: { id: true, name: true, category: true, phone: true } } },
            },
          },
          orderBy: { lineNo: "asc" },
        },
      },
      orderBy: { saleDate: "desc" },
      take: 100,
    });
    return rows;
  });
}
