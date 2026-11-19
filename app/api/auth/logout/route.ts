import { cookies } from "next/headers";
import { prisma } from "@/presentation/api/prisma";
import { getRequestSessionToken } from "@/presentation/auth/session";

export async function POST(request: Request) {
  const token = getRequestSessionToken(request);
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }
  const cookieStore = await cookies();
  cookieStore.delete("better-auth.session_token");
  cookieStore.delete("__Secure-better-auth.session_token");
  return Response.json({ ok: true });
}
