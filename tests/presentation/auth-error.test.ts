import { describe, expect, it } from "vitest";

import { AuthError, isAuthError } from "../../src/presentation/auth/auth-error";
import { requirePermissionForRoute, requireRole } from "../../src/presentation/auth/permissions";

describe("AuthError classification", () => {
  it("maps unauthenticated to 401 and authorization failures to 403", () => {
    expect(new AuthError("UNAUTHENTICATED", "Unauthorized").status).toBe(401);
    expect(new AuthError("NO_ACTIVE_BUSINESS", "Active business required").status).toBe(403);
    expect(new AuthError("FORBIDDEN", "Forbidden").status).toBe(403);
  });

  it("recognises AuthError but not unexpected infrastructure errors", () => {
    expect(isAuthError(new AuthError("FORBIDDEN", "Forbidden"))).toBe(true);
    // A database/connectivity error must NOT be treated as an auth failure —
    // this is what lets the middleware surface 503 instead of masking it as 401.
    expect(isAuthError(new Error("Can't reach database server"))).toBe(false);
    expect(isAuthError("nope")).toBe(false);
  });

  it("permission guards throw a 403 AuthError, not a generic Error", () => {
    try {
      requirePermissionForRoute({ role: "VIEWER" }, "/api/sales/orders", "POST");
      throw new Error("expected to throw");
    } catch (error) {
      expect(isAuthError(error)).toBe(true);
      expect((error as AuthError).status).toBe(403);
    }

    expect(() => requireRole({ role: "CASHIER" }, ["OWNER"])).toThrow(AuthError);
  });
});
