import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "../../src/presentation/auth/auth-error";

const redirect = vi.hoisted(() => vi.fn((destination: string) => {
  throw new Error(`REDIRECT:${destination}`);
}));
const getServerSessionToken = vi.hoisted(() => vi.fn());
const getAuthenticatedUserContextByToken = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/presentation/auth/session", () => ({
  getServerSessionToken,
  getAuthenticatedUserContextByToken,
}));

import Page from "../../app/page";

describe("root redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends visitors without a session to login", async () => {
    getServerSessionToken.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow("REDIRECT:/login");
  });

  it("sends an authenticated user with an active business to the dashboard", async () => {
    getServerSessionToken.mockResolvedValue("session-token");
    getAuthenticatedUserContextByToken.mockResolvedValue({ businessId: "business-1" });

    await expect(Page()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("sends a session without an active business to business selection", async () => {
    getServerSessionToken.mockResolvedValue("session-token");
    getAuthenticatedUserContextByToken.mockRejectedValue(new AuthError("NO_ACTIVE_BUSINESS", "Active business required"));

    await expect(Page()).rejects.toThrow("REDIRECT:/select-business");
  });
});
