import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireGodModeContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    await requireGodModeContext(request);
    return prisma.user.findMany({
      select: { id: true, name: true, email: true, platformRole: true, emailVerified: true, createdAt: true,
        memberships: { select: { role: true, isActive: true, business: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  });
}
