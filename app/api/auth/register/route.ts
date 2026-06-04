import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { cookies } from "next/headers";
import { BusinessType } from "@prisma/client";
import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { ChartOfAccountsService } from "@/features/chart-of-accounts/application/chart-of-accounts-service";
import { PrismaChartOfAccountsRepository } from "@/features/chart-of-accounts/infrastructure/prisma-chart-of-accounts-repository";

const coa = new ChartOfAccountsService(new PrismaChartOfAccountsRepository(prisma));

export async function POST(request: Request) {
  return handleApi(async () => {
    const { name, email, password, businessName, businessType } = await request.json() as { name: string; email: string; password: string; businessName: string; businessType?: string };
    if (!name?.trim() || !email?.trim() || !password || !businessName?.trim()) throw new Error("Semua field wajib diisi.");
    if (password.length < 8) throw new Error("Password minimal 8 karakter.");

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new Error("Email sudah terdaftar.");

    const user = await prisma.user.create({ data: { email: normalizedEmail, name: name.trim(), emailVerified: true } });
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.authAccount.create({ data: { userId: user.id, providerId: "credential", accountId: normalizedEmail, password: hash } });

    const business = await prisma.business.create({
      data: { name: businessName.trim(), type: (Object.values(BusinessType).includes(businessType?.trim() as BusinessType) ? businessType!.trim() as BusinessType : BusinessType.UMKM), status: "ACTIVE", fiscalYearStart: 1, currency: "IDR", settings: {}, createdByUserId: user.id },
    });
    await prisma.businessMember.create({ data: { businessId: business.id, userId: user.id, role: "OWNER", isActive: true } });

    await coa.seedSakEmkm({ businessId: business.id, actorUserId: user.id });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await prisma.session.create({ data: { userId: user.id, token, expiresAt, activeBusinessId: business.id } });

    const cookieStore = await cookies();
    cookieStore.set("better-auth.session_token", token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });

    return { user: { id: user.id, email: user.email, name: user.name }, business: { id: business.id, name: business.name } };
  });
}
