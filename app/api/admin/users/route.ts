import { hashPassword } from "@/presentation/auth/password";
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

export async function POST(request: Request) {
  return handleApi(async () => {
    await requireGodModeContext(request);
    const { name, email, password, platformRole, businessId, businessRole } =
      await request.json() as {
        name: string; email: string; password?: string;
        platformRole?: string; businessId?: string; businessRole?: string;
      };
    if (!name?.trim() || !email?.trim()) throw new Error("Nama dan email wajib diisi.");

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new Error("Email sudah terdaftar.");

    const pwd = password?.trim() || Math.random().toString(36).slice(-10) + "A1!";
    const hash = await hashPassword(pwd);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail, name: name.trim(), emailVerified: true,
        platformRole: (platformRole as any) ?? "USER",
      },
    });
    await prisma.authAccount.create({
      data: { userId: user.id, providerId: "credential", accountId: normalizedEmail, password: hash },
    });

    // Jika businessId diberikan, langsung tambah sebagai member
    if (businessId && businessRole) {
      const validRoles = ["ADMIN", "ACCOUNTANT", "EDITOR", "CASHIER", "VIEWER"];
      if (validRoles.includes(businessRole)) {
        await prisma.businessMember.create({
          data: { businessId, userId: user.id, role: businessRole as any, isActive: true },
        });
      }
    }

    return { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole };
  });
}
