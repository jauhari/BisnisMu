import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUserContextByToken, getServerSessionToken } from "@/presentation/auth/session";

async function requireAppSession() {
  const token = await getServerSessionToken();
  if (!token) redirect("/login");

  // Now uses React.cache — multiple calls in the same render (layout + children) hit DB only once.
  const context = await getAuthenticatedUserContextByToken(token);
  if (!context.businessId) redirect("/select-business");
}

export default async function Layout({ children }: { children: ReactNode }) {
  await requireAppSession();
  return <AppShell>{children}</AppShell>;
}
