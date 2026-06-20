import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/presentation/api/prisma";
import { getServerSessionToken } from "@/presentation/auth/session";

// Reset data bersifat destruktif -> hanya SUPER_ADMIN.
async function requireSuperAdminPage() {
  const token = await getServerSessionToken();
  if (!token) redirect("/login");

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) redirect("/login");
  if ((session.user.platformRole ?? "USER") !== "SUPER_ADMIN") redirect("/dashboard");
}

export default async function Layout({ children }: { children: ReactNode }) {
  await requireSuperAdminPage();
  return <>{children}</>;
}
