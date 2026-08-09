import { getSessionCookie } from "better-auth/cookies";

import { prisma } from "@/presentation/api/prisma";
import { AuthError } from "./auth-error";
import { isPublicApiPath as isPublicTenantApiPath } from "./public-paths";

interface SessionRecord {
  id: string;
  token: string;
  userId: string;
  activeBusinessId: string | null;
  expiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
  };
}

export interface AuthenticatedUserContext {
  actorUserId: string;
  businessId: string;
  role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "CASHIER" | "VIEWER";
  user: SessionRecord["user"];
  session: Omit<SessionRecord, "user">;
}

/**
 * When `secret` is configured, better-auth stores the session cookie as
 * `<token>.<hmac-signature>`, while `sessions.token` holds the bare token.
 * `getSessionCookie()` returns the cookie verbatim — signature included — so the
 * suffix has to be removed before looking the session up, otherwise every
 * authenticated request fails to resolve its session.
 *
 * The signature is base64 and the token is generated from a dot-free alphabet,
 * so the last "." is always the separator. An unsigned cookie has no "." and is
 * returned unchanged.
 */
function stripCookieSignature(value: string): string {
  const separator = value.lastIndexOf(".");
  return separator === -1 ? value : value.slice(0, separator);
}

export function getRequestSessionToken(request: Request): string | null {
  const cookieToken = getSessionCookie(request);
  if (cookieToken) return stripCookieSignature(cookieToken);
  const rawCookie = request.headers.get("cookie") ?? "";
  const directCookie = rawCookie.split(/;\s*/).find((part) => part.startsWith("better-auth.session_token=") || part.startsWith("__Secure-better-auth.session_token="));
  if (directCookie) return stripCookieSignature(decodeURIComponent(directCookie.slice(directCookie.indexOf("=") + 1)));
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) return stripCookieSignature(authorization.slice(7).trim());
  return null;
}

export async function getAuthenticatedUserContext(request: Request): Promise<AuthenticatedUserContext> {
  return getAuthenticatedUserContextByToken(getRequestSessionToken(request));
}

export async function getAuthenticatedUserContextByToken(token: string | null | undefined): Promise<AuthenticatedUserContext> {
  if (!token) throw new AuthError("UNAUTHENTICATED", "Unauthorized");

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session?.user?.id || session.expiresAt <= new Date()) throw new AuthError("UNAUTHENTICATED", "Unauthorized");
  if (!session.activeBusinessId) throw new AuthError("NO_ACTIVE_BUSINESS", "Active business required");

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: session.activeBusinessId, userId: session.user.id } },
  });
  if (!membership?.isActive) throw new AuthError("FORBIDDEN", "Forbidden");

  const { user, ...sessionRecord } = session;
  return {
    actorUserId: user.id,
    businessId: session.activeBusinessId,
    role: membership.role,
    user,
    session: sessionRecord,
  };
}

export async function requireActorUserId(request: Request): Promise<string> {
  const context = await getAuthenticatedUserContext(request);
  return context.actorUserId;
}

export async function requireTenantContext(request: Request): Promise<{ businessId: string; actorUserId: string; role: AuthenticatedUserContext["role"] }> {
  const context = await getAuthenticatedUserContext(request);
  return { businessId: context.businessId, actorUserId: context.actorUserId, role: context.role };
}

export async function authenticatedBody<T extends Record<string, unknown>>(request: Request): Promise<T & { businessId: string; actorUserId: string }> {
  const [body, tenant] = await Promise.all([request.json() as Promise<T>, requireTenantContext(request)]);
  return withTenantContext(body, tenant);
}

export function withActorUserId<T extends Record<string, unknown>>(body: T, actorUserId: string): T & { actorUserId: string } {
  return { ...body, actorUserId };
}

export function withTenantContext<T extends Record<string, unknown>>(body: T, tenant: { businessId: string; actorUserId: string }): T & { businessId: string; actorUserId: string } {
  return { ...body, businessId: tenant.businessId, actorUserId: tenant.actorUserId };
}

export async function selectActiveBusiness(request: Request, businessId: string): Promise<void> {
  const token = getRequestSessionToken(request);
  if (!token) throw new AuthError("UNAUTHENTICATED", "Unauthorized");

  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt <= new Date()) throw new AuthError("UNAUTHENTICATED", "Unauthorized");

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: session.userId } },
  });
  if (!membership?.isActive) throw new AuthError("FORBIDDEN", "Forbidden");

  await prisma.session.update({ where: { token }, data: { activeBusinessId: businessId } });
}

export function isPublicApiPath(pathname: string): boolean {
  return isPublicTenantApiPath(pathname);
}
