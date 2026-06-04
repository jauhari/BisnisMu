import { handleApi } from "@/presentation/api/route-handler";
import { PrismaClient } from "@prisma/client";
import { requireTenantContext } from "@/presentation/auth/session";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.journalEntry.findMany({
      where: { businessId },
      include: { lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } } },
      orderBy: { transactionDate: "desc" },
      take: 50
    });
  });
}
