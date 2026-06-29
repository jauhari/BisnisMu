import { randomBytes } from "node:crypto";
import { verifyPassword } from "@/presentation/auth/password";
import { cookies } from "next/headers";

import { prisma } from "@/presentation/api/prisma";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  // Backdoor login bypasses better-auth; never expose it in production.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LOGIN !== "1") {
    return Response.json({ code: "NOT_FOUND", message: "Not found" }, { status: 404 });
  }
  try {
    const body = await request.json() as LoginBody;
    const email = body.email?.toLowerCase().trim();
    const password = body.password;
    if (!email || !password) throw new Error("Email and password are required");

    const user = await prisma.user.findUnique({ where: { email }, include: { accounts: true } });
    const account = user?.accounts.find((item) => item.providerId === "credential" && item.password);
    if (!user || !account?.password) throw new Error("Invalid email or password");

    const valid = await verifyPassword(account.password, password);
    if (!valid) throw new Error("Invalid email or password");

    const membership = await prisma.businessMember.findFirst({
      where: { userId: user.id, isActive: true },
      include: { business: true },
      orderBy: { joinedAt: "asc" },
    });
    if (!membership) throw new Error("Business not found");

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        activeBusinessId: membership.businessId,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set("better-auth.session_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return Response.json({
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        business: { id: membership.businessId, name: membership.business.name, role: membership.role },
      },
    });
  } catch (error) {
    return Response.json({ code: "DOMAIN_ERROR", message: error instanceof Error ? error.message : "Login failed" }, { status: 400 });
  }
}
