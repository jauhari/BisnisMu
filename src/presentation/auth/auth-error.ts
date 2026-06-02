export type AuthErrorCode = "UNAUTHENTICATED" | "NO_ACTIVE_BUSINESS" | "FORBIDDEN";

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NO_ACTIVE_BUSINESS: 403,
  FORBIDDEN: 403,
};

/**
 * Represents an expected authentication/authorization failure (missing session,
 * inactive membership, insufficient permission). Distinct from unexpected
 * infrastructure errors (e.g. database connectivity), which must NOT be masked
 * as 401 by the middleware.
 */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
