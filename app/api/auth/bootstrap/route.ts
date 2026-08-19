import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { getRequestSessionToken } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => {
    const token = getRequestSessionToken(request);
    if (!token) throw new Error("Unauthorized");

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt <= new Date()) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { defaultBusinessId: true } });

    // Prefer the user's chosen default business; fall back to the earliest-joined
    // active membership if it was never set or no longer applies (e.g. removed from that business).
    const membership =
      (user?.defaultBusinessId &&
        (await prisma.businessMember.findFirst({
          where: { userId: session.userId, isActive: true, businessId: user.defaultBusinessId },
          include: { business: true },
        }))) ||
      (await prisma.businessMember.findFirst({
        where: { userId: session.userId, isActive: true },
        include: { business: true },
        orderBy: { joinedAt: "asc" },
      }));
    if (!membership) throw new Error("Business not found");

    await prisma.session.update({ where: { token }, data: { activeBusinessId: membership.businessId } });

    return {
      activeBusinessId: membership.businessId,
      businessName: membership.business.name,
      role: membership.role,
    };
  });
}
