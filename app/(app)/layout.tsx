import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/presentation/api/prisma";

async function requireAppSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("better-auth.session_token")?.value ?? cookieStore.get("__Secure-better-auth.session_token")?.value;
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
