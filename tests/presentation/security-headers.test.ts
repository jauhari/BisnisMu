import { describe, expect, it } from "vitest";

import { applySecurityHeaders, contentSecurityPolicy, securityHeaders, withSecurityHeaders } from "../../src/presentation/security/security-headers";

describe("security headers", () => {
  it("defines required headers", () => {
    const keys = securityHeaders.map((header) => header.key.toLowerCase());
    expect(keys).toContain("x-frame-options");
    expect(keys).toContain("x-content-type-options");
    expect(keys).toContain("referrer-policy");
    expect(keys).toContain("permissions-policy");
    expect(keys).toContain("strict-transport-security");
    expect(keys).toContain("content-security-policy");
  });

  it("defines CSP with object, frame, and base restrictions", () => {
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("style-src 'self' 'unsafe-inline'");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-src 'none'");
    expect(contentSecurityPolicy).toContain("base-uri 'self'");
  });

  it("defines HSTS", () => {
    const headers = applySecurityHeaders(new Headers());
    expect(headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains; preload");
  });

  it("defines frame protection", () => {
    const response = withSecurityHeaders(new Response(null));
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});
