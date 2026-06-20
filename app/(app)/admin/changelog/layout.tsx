import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/presentation/api/prisma";
import { getServerSessionToken } from "@/presentation/auth/session";

const ALLOWED = new Set(["SUPER_ADMIN", "SUPPORT_AGENT", "DEVELOPER"]);

async function requireGodModePage() {
  const token = await getServerSessionToken();
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
