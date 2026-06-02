export function isPublicApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/auth/") || pathname === "/api/auth" || pathname === "/api/health" || pathname === "/api/healthz" || pathname === "/api/ping";
}

export function hasBetterAuthSessionCookie(cookieHeader: string | null): boolean {
  return Boolean(cookieHeader?.includes("better-auth.session_token=") || cookieHeader?.includes("__Secure-better-auth.session_token="));
}
