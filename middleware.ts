import { NextResponse, type NextRequest } from "next/server";

import { isAuthError } from "@/presentation/auth/auth-error";
import { isPublicApiPath } from "@/presentation/auth/public-paths";
import { requirePermissionForRoute } from "@/presentation/auth/permissions";
import { apiRateLimitRule, authRateLimitRule, clientIp, getRateLimiter, rateLimitResponse } from "@/presentation/auth/rate-limit";
import { applyTrustedContextHeaders, clearTrustedContextHeaders, type TrustedRequestContext } from "@/presentation/auth/request-context";
import { getAuthenticatedUserContextByToken, getRequestSessionToken, requireGodMode } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";
import { withSecurityHeaders } from "@/presentation/security/security-headers";

function unauthorized(message = "Authentication required") {
  return withSecurityHeaders(Response.json({ ok: false, error: { code: "UNAUTHORIZED", message } }, { status: 401 }));
}

function forbidden(message = "Active business membership required") {
  return withSecurityHeaders(Response.json({ ok: false, error: { code: "FORBIDDEN", message } }, { status: 403 }));
}

function serviceUnavailable(message = "Service temporarily unavailable") {
  return withSecurityHeaders(Response.json({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message } }, { status: 503 }));
}

/**
 * Teruskan request ke handler bersama header konteks tenant yang sudah divalidasi.
 *
 * Next.js MENGGANTI seluruh header request dengan Headers yang diberikan ke
 * `NextResponse.next({ request: { headers } })` (header lain dibuang), jadi salinan
 * `request.headers` wajib diteruskan utuh — kalau tidak, cookie/content-type hilang.
 *
 * Header konteks milik client dihapus lalu ditulis ulang (delete + set), sehingga
 * nilai kiriman client tidak pernah sampai ke handler. Kalau `context` null, header
 * konteks dihapus seluruhnya → handler fallback ke DB.
 */
function nextWithTrustedContext(request: NextRequest, context: TrustedRequestContext | null): Response {
  const headers = new Headers(request.headers);
  if (context) applyTrustedContextHeaders(headers, context);
  else clearTrustedContextHeaders(headers);
  return withSecurityHeaders(NextResponse.next({ request: { headers } }));
}

async function enforceAuthRateLimit(request: NextRequest, pathname: string): Promise<Response | null> {
  const rule = authRateLimitRule(pathname);
  if (!rule) return null;
  const result = await getRateLimiter().limit(clientIp(request.headers), rule);
  return result.success ? null : withSecurityHeaders(rateLimitResponse(result));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) return nextWithTrustedContext(request, null);

  if (isPublicApiPath(pathname)) {
    const limited = await enforceAuthRateLimit(request, pathname);
    return limited ?? nextWithTrustedContext(request, null);
  }

  const token = getRequestSessionToken(request);
  if (!token) return unauthorized();

  // God mode routes — validate platform role, skip business context
  if (pathname.startsWith("/api/admin/") || pathname === "/api/admin") {
    try {
      const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
      if (!session?.user?.id || session.expiresAt <= new Date()) return unauthorized();
      requireGodMode({ platformRole: (session.user.platformRole ?? "USER") as any }, ["SUPER_ADMIN", "SUPPORT_AGENT", "DEVELOPER"]);
      return nextWithTrustedContext(request, null);
    } catch (error) {
      return isAuthError(error) ? forbidden("God mode access required") : serviceUnavailable();
    }
  }

  try {
    const context = await getAuthenticatedUserContextByToken(token);
    requirePermissionForRoute(context, pathname, request.method);

    const rule = apiRateLimitRule(pathname, request.method);
    const result = await getRateLimiter().limit(context.actorUserId, rule);
    if (!result.success) return withSecurityHeaders(rateLimitResponse(result));

    // Satu-satunya query auth per request. Handler di bawahnya cukup membaca header ini.
    return nextWithTrustedContext(request, {
      businessId: context.businessId,
      actorUserId: context.actorUserId,
      role: context.role,
      platformRole: context.platformRole,
    });
  } catch (error) {
    // Expected auth/authz failures map to 401/403. Anything else (e.g. database
    // connectivity loss) must surface as 503 — never masked as "unauthenticated".
    if (isAuthError(error)) {
      return error.status === 401 ? unauthorized() : forbidden();
    }
    console.error("[middleware] unexpected error during auth check", {
      pathname,
      method: request.method,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return serviceUnavailable();
  }
}

export const config = {
  runtime: "nodejs",
  matcher: ["/api/:path*"],
};
