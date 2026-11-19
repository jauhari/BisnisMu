import type { AuthenticatedUserContext, PlatformRole } from "./session";

/**
 * Konteks tenant yang SUDAH divalidasi middleware, diteruskan ke route handler
 * lewat header request. Tujuannya: handler tidak perlu mengulang 2 query auth
 * (session + businessMember) yang sudah dikerjakan middleware.
 *
 * Header ini selalu DITIMPA middleware (delete() lalu set()), jadi nilai kiriman
 * client dengan nama sama tidak pernah dipercaya.
 */
export const TRUSTED_CONTEXT_HEADERS = {
  verified: "x-tenant-verified",
  businessId: "x-tenant-business-id",
  actorUserId: "x-actor-user-id",
  role: "x-actor-role",
  platformRole: "x-platform-role",
} as const;

export const TRUSTED_CONTEXT_HEADER_NAMES: readonly string[] = Object.values(TRUSTED_CONTEXT_HEADERS);

/** Penanda bahwa header konteks diisi middleware, bukan dikirim client. */
const VERIFIED_VALUE = "1";

export const BUSINESS_ROLES = ["OWNER", "ADMIN", "ACCOUNTANT", "CASHIER", "VIEWER"] as const;
export const PLATFORM_ROLES = ["USER", "SUPER_ADMIN", "SUPPORT_AGENT", "FINANCE_ADMIN", "DEVELOPER"] as const;

export interface TrustedRequestContext {
  businessId: string;
  actorUserId: string;
  role: AuthenticatedUserContext["role"];
  platformRole: PlatformRole;
}

function isBusinessRole(value: string): value is AuthenticatedUserContext["role"] {
  return (BUSINESS_ROLES as readonly string[]).includes(value);
}

function isPlatformRole(value: string): value is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(value);
}

/** Buang semua header konteks supaya request tanpa middleware tidak bisa "membawa" konteks palsu. */
export function clearTrustedContextHeaders(headers: Headers): void {
  for (const name of TRUSTED_CONTEXT_HEADER_NAMES) headers.delete(name);
}

/**
 * Tulis konteks ke header request yang diteruskan ke handler.
 * delete() dilakukan lebih dulu agar header kiriman client benar-benar hilang
 * (bukan hanya tertimpa sebagian / menyisakan entri duplikat).
 */
export function applyTrustedContextHeaders(headers: Headers, context: TrustedRequestContext): void {
  clearTrustedContextHeaders(headers);
  headers.set(TRUSTED_CONTEXT_HEADERS.businessId, context.businessId);
  headers.set(TRUSTED_CONTEXT_HEADERS.actorUserId, context.actorUserId);
  headers.set(TRUSTED_CONTEXT_HEADERS.role, context.role);
  headers.set(TRUSTED_CONTEXT_HEADERS.platformRole, context.platformRole);
  headers.set(TRUSTED_CONTEXT_HEADERS.verified, VERIFIED_VALUE);
}

/**
 * Baca konteks dari header tanpa query DB.
 *
 * Mengembalikan null kalau header tidak lengkap / tidak valid (mis. dipanggil dari
 * RSC, layout, atau request yang tidak lewat middleware). Pemanggil WAJIB fallback
 * ke database — bukan menganggap request terautentikasi.
 */
export function contextFromTrustedHeaders(headers: Headers): TrustedRequestContext | null {
  if (headers.get(TRUSTED_CONTEXT_HEADERS.verified) !== VERIFIED_VALUE) return null;

  const businessId = headers.get(TRUSTED_CONTEXT_HEADERS.businessId)?.trim() ?? "";
  const actorUserId = headers.get(TRUSTED_CONTEXT_HEADERS.actorUserId)?.trim() ?? "";
  const role = headers.get(TRUSTED_CONTEXT_HEADERS.role)?.trim() ?? "";
  const platformRole = headers.get(TRUSTED_CONTEXT_HEADERS.platformRole)?.trim() ?? "";

  if (!businessId || !actorUserId) return null;
  if (!isBusinessRole(role) || !isPlatformRole(platformRole)) return null;

  return { businessId, actorUserId, role, platformRole };
}
