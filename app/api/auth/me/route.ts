import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { getRequestSessionToken } from "@/presentation/auth/session";
import { z } from "zod";
import argon2 from "argon2";

async function getSessionUser(request: Request) {
  const token = getRequestSessionToken(request);
  if (!token) throw new Error("Tidak ada sesi aktif.");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) throw new Error("Sesi tidak valid.");
  return session.user;
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const user = await getSessionUser(request);
    return { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole };
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
      const valid = await argon2.verify(authAccount.password, body.currentPassword);
      if (!valid) throw new Error("Password saat ini tidak cocok.");
      const hashed = await argon2.hash(body.newPassword, { type: argon2.argon2id });
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
