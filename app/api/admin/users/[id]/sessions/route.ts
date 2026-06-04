import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireGodModeContext } from "@/presentation/auth/session";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    await requireGodModeContext(request); // throws if not SUPER_ADMIN/SUPPORT_AGENT
    const { id } = await params;
    const deleted = await prisma.session.deleteMany({ where: { userId: id } });
    return { deleted: deleted.count };
  });
}
