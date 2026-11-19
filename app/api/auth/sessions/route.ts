import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { getRequestSessionToken } from "@/presentation/auth/session";

export async function DELETE(request: Request) {
  return handleApi(async () => {
    const token = getRequestSessionToken(request);
    if (!token) throw new Error("Unauthorized");

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt <= new Date()) throw new Error("Unauthorized");

    const all = new URL(request.url).searchParams.get("all") === "true";

    const deleted = await prisma.session.deleteMany({
      where: {
        userId: session.userId,
        ...(all ? {} : { token: { not: token } }), // exclude current session unless ?all=true
      },
    });

    return { deleted: deleted.count };
  });
}
