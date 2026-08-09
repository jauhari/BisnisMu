import { describe, expect, it } from "vitest";

import { getRequestSessionToken, isPublicApiPath, withActorUserId, withTenantContext } from "../../src/presentation/auth/session";

const RAW_TOKEN = "At8GzdzEnHqa2Nj1EAhIUB64QNblJPHR";
// better-auth signs the cookie as `<token>.<base64 hmac>` whenever a secret is
// configured, while sessions.token stores the bare token.
const SIGNATURE = "n0g3Rx/Y3iE2kv47ZJ2Eb5bn/AIjt2+FbYCS1A0CUFA=";

function requestWithCookie(cookie: string): Request {
  return new Request("http://localhost/api/inventory/products", { headers: { cookie } });
}

describe("getRequestSessionToken", () => {
  it("strips the signature from a signed session cookie so it matches sessions.token", () => {
    const cookie = `better-auth.session_token=${encodeURIComponent(`${RAW_TOKEN}.${SIGNATURE}`)}`;

    expect(getRequestSessionToken(requestWithCookie(cookie))).toBe(RAW_TOKEN);
  });

  it("strips the signature from the __Secure- prefixed cookie", () => {
    const cookie = `__Secure-better-auth.session_token=${encodeURIComponent(`${RAW_TOKEN}.${SIGNATURE}`)}`;

    expect(getRequestSessionToken(requestWithCookie(cookie))).toBe(RAW_TOKEN);
  });

  it("returns an unsigned cookie token unchanged", () => {
    expect(getRequestSessionToken(requestWithCookie(`better-auth.session_token=${RAW_TOKEN}`))).toBe(RAW_TOKEN);
  });

  it("reads and unsigns a bearer token", () => {
    const request = new Request("http://localhost/api/inventory/products", {
      headers: { authorization: `Bearer ${RAW_TOKEN}.${SIGNATURE}` },
    });

    expect(getRequestSessionToken(request)).toBe(RAW_TOKEN);
  });

  it("returns null when no session cookie or bearer token is present", () => {
    expect(getRequestSessionToken(requestWithCookie("other=1"))).toBeNull();
  });
});

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
