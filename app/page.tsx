import { redirect } from "next/navigation";

import { isAuthError } from "@/presentation/auth/auth-error";
import { getAuthenticatedUserContextByToken, getServerSessionToken } from "@/presentation/auth/session";

export default async function Page() {
  const token = await getServerSessionToken();
  if (!token) redirect("/login");

  try {
    await getAuthenticatedUserContextByToken(token);
  } catch (error) {
    if (isAuthError(error) && error.code === "NO_ACTIVE_BUSINESS") redirect("/select-business");
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  redirect("/dashboard");
}
