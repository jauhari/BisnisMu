import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { getRequestSessionToken } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => {
    const token = getRequestSessionToken(request);
    if (!token) throw new Error("Unauthorized");

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt <= new Date()) throw new Error("Unauthorized");

    const membership = await prisma.businessMember.findFirst({
      where: { userId: session.userId, isActive: true },
      include: { business: true },
      orderBy: { joinedAt: "asc" },
    });
    if (!membership) throw new Error("Business not found");

    await prisma.session.update({ where: { token }, data: { activeBusinessId: membership.businessId } });

    return {
      activeBusinessId: membership.businessId,
      businessName: membership.business.name,
      role: membership.role,
    };
  });
}
