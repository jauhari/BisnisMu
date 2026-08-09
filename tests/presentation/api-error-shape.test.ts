import { describe, expect, it } from "vitest";
import { rateLimitResponse } from "../../src/presentation/auth/rate-limit";
import { handleApi } from "../../src/presentation/api/route-handler";
import { PosError } from "../../src/features/pos/domain/pos-types";
import { AuthError } from "../../src/presentation/auth/auth-error";

/**
 * The presentation client reads `{ code, message }` off any non-2xx response. Every
 * error producer therefore has to emit that same flat shape -- middleware included,
 * which used to nest it under `error` and so rendered as "undefined" in the UI.
 */
async function shapeOf(response: Response): Promise<string[]> {
  return Object.keys((await response.json()) as Record<string, unknown>).sort();
}

describe("error response shape", () => {
  it("uses code and message for a domain failure", async () => {
    const response = await handleApi(async () => { throw new PosError("CART_EMPTY", "Cannot checkout an empty cart."); });
    expect(await shapeOf(response)).toEqual(["code", "message"]);
  });

  it("uses code and message for an auth failure", async () => {
    const response = await handleApi(async () => { throw new AuthError("UNAUTHENTICATED", "Authentication required"); });
    expect(response.status).toBe(401);
    expect(await shapeOf(response)).toEqual(["code", "message"]);
  });

  it("uses code and message when rate limited", async () => {
    const response = rateLimitResponse({ success: false, limit: 5, remaining: 0, resetAt: Date.now() + 30_000, retryAfter: 30 });
    expect(response.status).toBe(429);
    expect(await shapeOf(response)).toEqual(["code", "message"]);
  });

  it("carries a non-empty message on every error, so the UI never shows undefined", async () => {
    const responses = [
      await handleApi(async () => { throw new PosError("CART_EMPTY", "Cannot checkout an empty cart."); }),
      await handleApi(async () => { throw new AuthError("FORBIDDEN", "Active business membership required"); }),
      rateLimitResponse({ success: false, limit: 5, remaining: 0, resetAt: Date.now() + 1000, retryAfter: 1 })
    ];

    for (const response of responses) {
      const body = await response.json() as { code?: string; message?: string };
      expect(typeof body.code).toBe("string");
      expect(body.message && body.message.length).toBeTruthy();
    }
  });
});
