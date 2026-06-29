import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { requireTenantContext } from "@/presentation/auth/session";


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
