import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { requirePermission } from "@/presentation/auth/permissions";
import { AuthError } from "@/presentation/auth/auth-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { id } = await params;
    const ctx = await requireTenantContext(request);
    requirePermission(ctx, "tenant:manage");
    const { role } = await request.json() as { role: string };
    const member = await prisma.businessMember.findUnique({ where: { id } });
    if (!member || member.businessId !== ctx.businessId) throw new AuthError("FORBIDDEN", "Member tidak ditemukan.");
    if (member.userId === ctx.actorUserId) throw new AuthError("FORBIDDEN", "Tidak bisa ubah role sendiri.");
    return prisma.businessMember.update({ where: { id }, data: { role: role as any } });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { id } = await params;
    const ctx = await requireTenantContext(request);
    requirePermission(ctx, "tenant:manage");
    const member = await prisma.businessMember.findUnique({ where: { id } });
    if (!member || member.businessId !== ctx.businessId) throw new AuthError("FORBIDDEN", "Member tidak ditemukan.");
    if (member.userId === ctx.actorUserId) throw new AuthError("FORBIDDEN", "Tidak bisa nonaktifkan diri sendiri.");
    return prisma.businessMember.update({ where: { id }, data: { isActive: false } });
  });
}
