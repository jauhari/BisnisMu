import { describe, expect, it } from "vitest";

import { isPublicApiPath, withActorUserId, withTenantContext } from "../../src/presentation/auth/session";

describe("auth session helpers", () => {
  it("allows auth and health API paths without middleware session enforcement", () => {
    expect(isPublicApiPath("/api/auth/sign-in/email")).toBe(true);
    expect(isPublicApiPath("/api/auth")).toBe(true);
    expect(isPublicApiPath("/api/health")).toBe(true);
    expect(isPublicApiPath("/api/healthz")).toBe(true);
    expect(isPublicApiPath("/api/accounting/journals")).toBe(false);
  });

  it("overrides client-supplied actorUserId with authenticated session user id", () => {
    const command = withActorUserId({ businessId: "biz-1", actorUserId: "spoofed" }, "user-1");

    expect(command).toEqual({ businessId: "biz-1", actorUserId: "user-1" });
  });

  it("overrides client-supplied tenant ids with authenticated tenant context", () => {
    const command = withTenantContext(
      { businessId: "spoofed-biz", actorUserId: "spoofed-user", amount: 100 },
      { businessId: "biz-1", actorUserId: "user-1" },
    );

    expect(command).toEqual({ businessId: "biz-1", actorUserId: "user-1", amount: 100 });
  });
});
