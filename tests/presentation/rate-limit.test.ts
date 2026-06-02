import { describe, expect, it } from "vitest";

import {
  API_WRITE_LIMIT,
  AUTH_LOGIN_LIMIT,
  REPORT_LIMIT,
  MemoryRateLimiter,
  apiRateLimitRule,
  authRateLimitRule,
  rateLimitResponse,
} from "../../src/presentation/auth/rate-limit";

describe("rate limiting", () => {
  it("throttles auth login after 5 requests per minute", async () => {
    const limiter = new MemoryRateLimiter();
    const rule = authRateLimitRule("/api/auth/sign-in/email") ?? AUTH_LOGIN_LIMIT;
    for (let i = 0; i < 5; i++) {
      await expect(limiter.limit("ip:1", rule)).resolves.toMatchObject({ success: true });
    }
    await expect(limiter.limit("ip:1", rule)).resolves.toMatchObject({ success: false, limit: 5 });
  });

  it("throttles write endpoints after 100 requests per minute per user", async () => {
    const limiter = new MemoryRateLimiter();
    const rule = apiRateLimitRule("/api/sales/orders", "POST");
    expect(rule).toEqual(API_WRITE_LIMIT);
    for (let i = 0; i < 100; i++) await limiter.limit("user-1", rule);
    await expect(limiter.limit("user-1", rule)).resolves.toMatchObject({ success: false, limit: 100 });
  });

  it("throttles reports after 30 requests per minute", async () => {
    const limiter = new MemoryRateLimiter();
    const rule = apiRateLimitRule("/api/reports/profit-loss", "POST");
    expect(rule).toEqual(REPORT_LIMIT);
    for (let i = 0; i < 30; i++) await limiter.limit("user-1", rule);
    await expect(limiter.limit("user-1", rule)).resolves.toMatchObject({ success: false, limit: 30 });
  });

  it("returns retry-after header on 429", async () => {
    const response = rateLimitResponse({ success: false, limit: 5, remaining: 0, resetAt: Date.now() + 30_000, retryAfter: 30 });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    await expect(response.json()).resolves.toEqual({ error: "RATE_LIMIT_EXCEEDED" });
  });
});
