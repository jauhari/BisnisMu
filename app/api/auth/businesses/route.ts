import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { getRequestSessionToken } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    const token = getRequestSessionToken(request);
    if (!token) throw new Error("Unauthorized");

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt <= new Date()) throw new Error("Unauthorized");

    const memberships = await prisma.businessMember.findMany({
      where: { userId: session.userId, isActive: true },
      include: { business: true },
      orderBy: { joinedAt: "asc" },
    });

    return memberships.map((membership) => ({
      id: membership.business.id,
      name: membership.business.name,
      role: membership.role,
      active: membership.business.id === session.activeBusinessId,
    }));
  });
}
