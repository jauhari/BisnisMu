import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/presentation/api/prisma";

// Reset data bersifat destruktif -> hanya SUPER_ADMIN.
async function requireSuperAdminPage() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("better-auth.session_token")?.value ??
    cookieStore.get("__Secure-better-auth.session_token")?.value;
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
