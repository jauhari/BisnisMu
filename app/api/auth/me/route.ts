import { unstable_cache } from "next/cache";

import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { getRequestSessionToken, requireTenantContext } from "@/presentation/auth/session";
import { canHardMutateOrganizationTransaction, organizationHardMutationEnabled } from "@/presentation/auth/permissions";
import { z } from "zod";
import { verifyPassword, hashPassword } from "@/presentation/auth/password";

const getCachedSessionUser = unstable_cache(
  async (token: string) => {
    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) throw new Error("Sesi tidak valid.");
    return session.user;
  },
  ["session-user"],
  { revalidate: 300 }
);

async function getSessionUser(request: Request) {
  const token = getRequestSessionToken(request);
  if (!token) throw new Error("Tidak ada sesi aktif.");
  return getCachedSessionUser(token);
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const [user, tenant] = await Promise.all([getSessionUser(request), requireTenantContext(request)]);
    const business = await prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } });
    return { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole, role: tenant.role, businessId: tenant.businessId, hardMutation: canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings)) };
  });
}

const updateSchema = z.object({
  name:            z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8).optional(),
});

export async function PUT(request: Request) {
  return handleApi(async () => {
    const user = await getSessionUser(request);
    const body = updateSchema.parse(await request.json());

    if (body.newPassword) {
      if (!body.currentPassword) throw new Error("Password saat ini wajib diisi.");
      const authAccount = await prisma.authAccount.findUnique({
        where: { providerId_accountId: { providerId: "credential", accountId: user.email } },
      });
      if (!authAccount?.password) throw new Error("Akun tidak menggunakan password.");
      const valid = await verifyPassword(authAccount.password, body.currentPassword);
      if (!valid) throw new Error("Password saat ini tidak cocok.");
      const hashed = await hashPassword(body.newPassword);
      await prisma.authAccount.update({
        where: { providerId_accountId: { providerId: "credential", accountId: user.email } },
        data: { password: hashed },
      });
    }

    if (body.name) {
      await prisma.user.update({ where: { id: user.id }, data: { name: body.name } });
    }

    return { ok: true };
  });
}
