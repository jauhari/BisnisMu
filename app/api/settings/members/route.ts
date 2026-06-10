import argon2 from "argon2";
import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { requirePermission } from "@/presentation/auth/permissions";

export async function GET(request: Request) {
  return handleApi(async () => {
    const ctx = await requireTenantContext(request);
    return prisma.businessMember.findMany({
      where: { businessId: ctx.businessId },
      include: { user: { select: { id: true, name: true, email: true, platformRole: true } } },
      orderBy: { joinedAt: "asc" },
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const ctx = await requireTenantContext(request);
    requirePermission(ctx, "tenant:manage");
    const { name, email, password, role } = await request.json() as { name: string; email: string; password?: string; role: string };
    if (!name?.trim() || !email?.trim()) throw new Error("Nama dan email wajib diisi.");
    const validRoles = ["ADMIN", "ACCOUNTANT", "EDITOR", "CASHIER", "VIEWER"];
    if (!validRoles.includes(role)) throw new Error("Role tidak valid.");

    const normalizedEmail = email.toLowerCase().trim();
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      const pwd = password?.trim() || Math.random().toString(36).slice(-10) + "A1!";
      const hash = await argon2.hash(pwd, { type: argon2.argon2id });
      user = await prisma.user.create({ data: { email: normalizedEmail, name: name.trim(), emailVerified: true } });
      await prisma.authAccount.create({ data: { userId: user.id, providerId: "credential", accountId: normalizedEmail, password: hash } });
    }

    const existing = await prisma.businessMember.findUnique({ where: { businessId_userId: { businessId: ctx.businessId, userId: user.id } } });
    if (existing) {
      return prisma.businessMember.update({ where: { id: existing.id }, data: { role: role as any, isActive: true } });
    }
    return prisma.businessMember.create({ data: { businessId: ctx.businessId, userId: user.id, role: role as any, isActive: true, invitedBy: ctx.actorUserId, invitedAt: new Date() } });
  });
}
