import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireGodModeContext } from "@/presentation/auth/session";
import { z } from "zod";

const schema = z.object({ platformRole: z.enum(["USER", "SUPER_ADMIN", "SUPPORT_AGENT", "FINANCE_ADMIN", "DEVELOPER"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const ctx = await requireGodModeContext(request);
    const { id } = await params;
    const { platformRole } = schema.parse(await request.json());
    if (id === ctx.actorUserId) throw new Error("Tidak bisa ubah platform role sendiri.");
    return prisma.user.update({ where: { id }, data: { platformRole } });
  });
}
