import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/presentation/api/prisma";
import { getServerSessionToken } from "@/presentation/auth/session";

async function requireAppSession() {
  const token = await getServerSessionToken();
  if (!token) redirect("/login");

  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt <= new Date()) redirect("/login");
  if (!session.activeBusinessId) redirect("/select-business");

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: session.activeBusinessId, userId: session.userId } },
  });
  if (!membership?.isActive) redirect("/login");
}

export default async function Layout({ children }: { children: ReactNode }) {
  await requireAppSession();
  return <AppShell>{children}</AppShell>;
}
