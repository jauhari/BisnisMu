import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/presentation/api/prisma";

const ALLOWED = new Set(["SUPER_ADMIN", "SUPPORT_AGENT", "DEVELOPER"]);

async function requireGodModePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("better-auth.session_token")?.value ?? cookieStore.get("__Secure-better-auth.session_token")?.value;
  if (!token) redirect("/login");

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true }
  });
  if (!session || session.expiresAt <= new Date()) redirect("/login");
  if (!ALLOWED.has((session.user.platformRole ?? "USER") as any)) redirect("/dashboard");
}

export default async function Layout({ children }: { children: ReactNode }) {
  await requireGodModePage();
  return <>{children}</>;
}
