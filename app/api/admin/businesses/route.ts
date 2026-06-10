import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireGodModeContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    await requireGodModeContext(request);
    return prisma.business.findMany({
      select: { id: true, name: true, type: true, status: true, createdAt: true,
        members: { select: { role: true, isActive: true, user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  });
}
