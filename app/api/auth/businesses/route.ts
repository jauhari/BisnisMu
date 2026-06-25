import { unstable_cache } from "next/cache";

import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { getRequestSessionToken } from "@/presentation/auth/session";

const getCachedUserBusinesses = unstable_cache(
  async (userId: string, activeBusinessId: string | null) => {
    const memberships = await prisma.businessMember.findMany({
      where: { userId, isActive: true },
      include: { business: true },
      orderBy: { joinedAt: "asc" },
    });

    return memberships.map((membership) => ({
      id: membership.business.id,
      name: membership.business.name,
      role: membership.role,
      active: membership.business.id === activeBusinessId,
    }));
  },
  ["user-businesses"],
  { revalidate: 300, tags: ["businesses"] } // 5 minutes cache for businesses list
);

export async function GET(request: Request) {
  return handleApi(async () => {
    const token = getRequestSessionToken(request);
    if (!token) throw new Error("Unauthorized");

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt <= new Date()) throw new Error("Unauthorized");

    return getCachedUserBusinesses(session.userId, session.activeBusinessId);
  });
}
