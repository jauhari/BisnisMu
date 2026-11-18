import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  businessMember: { findUnique: vi.fn() },
}));

vi.mock("@/presentation/api/prisma", () => ({ prisma: prismaMock }));

const { middleware } = await import("../../middleware");

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

function sessionRecord(platformRole = "OWNER") {
  return {
    id: "session-1",
    token: "session-token",
    userId: "user-1",
    activeBusinessId: "biz-1",
    expiresAt: FUTURE,
    createdAt: FUTURE,
    updatedAt: FUTURE,
    ipAddress: null,
    userAgent: null,
    user: {
      id: "user-1",
      name: "Sari",
      email: "sari@example.com",
      emailVerified: true,
      image: null,
      platformRole,
      createdAt: FUTURE,
      updatedAt: FUTURE,
      defaultBusinessId: null,
      memberships: [
        {
          id: "member-1",
          userId: "user-1",
          businessId: "biz-1",
          role: platformRole === "SUPER_ADMIN" ? "ADMIN" : "OWNER",
          isActive: true,
          invitedBy: null,
          invitedAt: null,
          joinedAt: FUTURE,
          createdAt: FUTURE,
          updatedAt: FUTURE,
        },
      ],
    },
  };
}

/** Header konteks yang dikirim client — semuanya harus ditimpa/dibuang middleware. */
function spoofedHeaders(): Headers {
  return new Headers({
    cookie: "better-auth.session_token=session-token.signature",
    "x-tenant-verified": "1",
    "x-tenant-business-id": "biz-spoofed",
    "x-actor-user-id": "user-spoofed",
    "x-actor-role": "OWNER",
    "x-platform-role": "SUPER_ADMIN",
  });
}

beforeEach(() => {
  prismaMock.session.findUnique.mockReset();
  prismaMock.businessMember.findUnique.mockReset();
});

describe("middleware meneruskan konteks tenant lewat header", () => {
  it("menulis ulang header konteks kiriman client dengan hasil validasi, satu query auth", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRecord());
    const request = new NextRequest("http://localhost/api/reports/profit-loss", { headers: spoofedHeaders(), method: "GET" });

    const response = await middleware(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-tenant-verified")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-tenant-business-id")).toBe("biz-1");
    expect(response.headers.get("x-middleware-request-x-actor-user-id")).toBe("user-1");
    expect(response.headers.get("x-middleware-request-x-actor-role")).toBe("OWNER");

    // Nilai palsu dari client tidak boleh ikut diteruskan.
    const forwarded = [...response.headers].map(([key, value]) => `${key}: ${value}`).join("\n");
    expect(forwarded).not.toContain("biz-spoofed");
    expect(forwarded).not.toContain("user-spoofed");

    // 1 query auth (session + membership), bukan 2.
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.businessMember.findUnique).not.toHaveBeenCalled();
  });

  it("tidak meneruskan header konteks pada route god mode walau client mengirimnya", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRecord("SUPER_ADMIN"));
    const request = new NextRequest("http://localhost/api/admin/users", { headers: spoofedHeaders(), method: "GET" });

    const response = await middleware(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-tenant-verified")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-tenant-business-id")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-actor-user-id")).toBeNull();
  });

  it("menolak request tanpa sesi (401) tanpa meneruskan konteks", async () => {
    const request = new NextRequest("http://localhost/api/reports/profit-loss", { method: "GET" });

    const response = await middleware(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("x-middleware-request-x-tenant-business-id")).toBeNull();
  });
});
