import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "../../src/presentation/auth/auth-error";
import { applyTrustedContextHeaders, clearTrustedContextHeaders, contextFromTrustedHeaders, TRUSTED_CONTEXT_HEADERS } from "../../src/presentation/auth/request-context";
import { getRequestTenantContext, requireActorUserId, requireTenantContext } from "../../src/presentation/auth/session";

const prismaMock = vi.hoisted(() => ({
  session: { findUnique: vi.fn() },
  businessMember: { findUnique: vi.fn() },
}));

vi.mock("@/presentation/api/prisma", () => ({ prisma: prismaMock }));

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 1000);

function trustedHeaders(overrides: Record<string, string> = {}): Headers {
  const headers = new Headers();
  headers.set(TRUSTED_CONTEXT_HEADERS.verified, "1");
  headers.set(TRUSTED_CONTEXT_HEADERS.businessId, "biz-1");
  headers.set(TRUSTED_CONTEXT_HEADERS.actorUserId, "user-1");
  headers.set(TRUSTED_CONTEXT_HEADERS.role, "ADMIN");
  headers.set(TRUSTED_CONTEXT_HEADERS.platformRole, "USER");
  for (const [name, value] of Object.entries(overrides)) headers.set(name, value);
  return headers;
}

function sessionRecord(options: { expiresAt?: Date; activeBusinessId?: string | null; memberships?: Array<{ businessId: string; role: string; isActive: boolean }> } = {}) {
  const memberships = options.memberships ?? [{ businessId: "biz-1", role: "OWNER", isActive: true }];
  return {
    id: "session-1",
    token: "session-token",
    userId: "user-1",
    activeBusinessId: options.activeBusinessId === undefined ? "biz-1" : options.activeBusinessId,
    expiresAt: options.expiresAt ?? FUTURE,
    ipAddress: null,
    userAgent: null,
    createdAt: FUTURE,
    updatedAt: FUTURE,
    user: {
      id: "user-1",
      name: "Sari",
      email: "sari@example.com",
      emailVerified: true,
      image: null,
      platformRole: "USER",
      createdAt: FUTURE,
      updatedAt: FUTURE,
      defaultBusinessId: null,
      memberships: memberships.map((membership, index) => ({
        id: `member-${index}`,
        userId: "user-1",
        businessId: membership.businessId,
        role: membership.role,
        isActive: membership.isActive,
        invitedBy: null,
        invitedAt: null,
        joinedAt: FUTURE,
        createdAt: FUTURE,
        updatedAt: FUTURE,
      })),
    },
  };
}

function requestWithCookie(headers: Headers = new Headers()): Request {
  // Token unik per test agar cache() React tidak pernah menyamarkan query yang dihitung.
  headers.set("cookie", `better-auth.session_token=${Math.random().toString(36).slice(2)}.signature`);
  return new Request("http://localhost/api/reports/profit-loss", { headers });
}

beforeEach(() => {
  prismaMock.session.findUnique.mockReset();
  prismaMock.businessMember.findUnique.mockReset();
});

describe("konteks tenant dari header middleware", () => {
  it("tidak menyentuh database sama sekali kalau header konteks lengkap", async () => {
    const request = new Request("http://localhost/api/reports/profit-loss", { headers: trustedHeaders() });

    const tenant = await requireTenantContext(request);

    expect(tenant).toEqual({ businessId: "biz-1", actorUserId: "user-1", role: "ADMIN" });
    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.businessMember.findUnique).not.toHaveBeenCalled();
  });

  it("memberi actorUserId dari header tanpa query saat requireActorUserId dipanggil", async () => {
    const request = new Request("http://localhost/api/organizations", { headers: trustedHeaders() });

    await expect(requireActorUserId(request)).resolves.toBe("user-1");
    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
  });

  it("fallback ke database kalau header tidak lengkap (bukan dianggap terautentikasi)", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRecord());

    const headers = trustedHeaders();
    headers.delete(TRUSTED_CONTEXT_HEADERS.role);
    const request = requestWithCookie(headers);

    const tenant = await getRequestTenantContext(request);

    expect(tenant).toEqual({ businessId: "biz-1", actorUserId: "user-1", role: "OWNER" });
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(1);
  });

  it("fallback ke database kalau header verified tidak ada walau field lain dikirim client", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRecord());

    const headers = new Headers();
    headers.set(TRUSTED_CONTEXT_HEADERS.businessId, "biz-palsu");
    headers.set(TRUSTED_CONTEXT_HEADERS.actorUserId, "user-palsu");
    headers.set(TRUSTED_CONTEXT_HEADERS.role, "OWNER");
    headers.set(TRUSTED_CONTEXT_HEADERS.platformRole, "SUPER_ADMIN");
    const request = requestWithCookie(headers);

    const tenant = await requireTenantContext(request);

    expect(tenant).toEqual({ businessId: "biz-1", actorUserId: "user-1", role: "OWNER" });
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("query auth di jalur fallback", () => {
  it("mengambil session + membership dalam satu query dan mencocokkan businessId di JS", async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRecord({
        activeBusinessId: "biz-2",
        memberships: [
          { businessId: "biz-1", role: "OWNER", isActive: true },
          { businessId: "biz-2", role: "CASHIER", isActive: true },
        ],
      }),
    );

    const tenant = await requireTenantContext(requestWithCookie());

    expect(tenant).toEqual({ businessId: "biz-2", actorUserId: "user-1", role: "CASHIER" });
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(1);
    // Query businessMember terpisah sudah dihapus — total 1 round-trip, bukan 2.
    expect(prismaMock.businessMember.findUnique).not.toHaveBeenCalled();
  });

  it("meminta hanya membership aktif lewat include (filter di database)", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRecord());

    await requireTenantContext(requestWithCookie());

    const args = prismaMock.session.findUnique.mock.calls[0]?.[0];
    expect(args?.include?.user?.include?.memberships).toEqual({ where: { isActive: true } });
  });

  it("melempar UNAUTHENTICATED untuk session kedaluwarsa", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRecord({ expiresAt: PAST }));

    await expect(requireTenantContext(requestWithCookie())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("melempar UNAUTHENTICATED kalau session tidak ada", async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    await expect(requireTenantContext(requestWithCookie())).rejects.toBeInstanceOf(AuthError);
  });

  it("melempar NO_ACTIVE_BUSINESS kalau session belum punya business aktif", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRecord({ activeBusinessId: null }));

    await expect(requireTenantContext(requestWithCookie())).rejects.toMatchObject({ code: "NO_ACTIVE_BUSINESS" });
  });

  it("melempar FORBIDDEN kalau tidak ada membership aktif untuk business aktif", async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRecord({
        activeBusinessId: "biz-3",
        memberships: [{ businessId: "biz-1", role: "OWNER", isActive: true }],
      }),
    );

    await expect(requireTenantContext(requestWithCookie())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("melempar FORBIDDEN kalau membership yang cocok non-aktif", async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRecord({ memberships: [{ businessId: "biz-1", role: "OWNER", isActive: false }] }),
    );

    await expect(requireTenantContext(requestWithCookie())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("penulisan header konteks", () => {
  it("menimpa header kiriman client dengan nilai hasil validasi middleware", () => {
    const headers = new Headers();
    headers.set(TRUSTED_CONTEXT_HEADERS.businessId, "biz-palsu");
    headers.append(TRUSTED_CONTEXT_HEADERS.businessId, "biz-palsu-2");
    headers.set(TRUSTED_CONTEXT_HEADERS.actorUserId, "user-palsu");
    headers.set(TRUSTED_CONTEXT_HEADERS.role, "OWNER");
    headers.set(TRUSTED_CONTEXT_HEADERS.platformRole, "SUPER_ADMIN");
    headers.set(TRUSTED_CONTEXT_HEADERS.verified, "0");

    applyTrustedContextHeaders(headers, { businessId: "biz-1", actorUserId: "user-1", role: "ADMIN", platformRole: "USER" });

    expect(headers.get(TRUSTED_CONTEXT_HEADERS.businessId)).toBe("biz-1");
    expect(headers.get(TRUSTED_CONTEXT_HEADERS.actorUserId)).toBe("user-1");
    expect(headers.get(TRUSTED_CONTEXT_HEADERS.role)).toBe("ADMIN");
    expect(headers.get(TRUSTED_CONTEXT_HEADERS.platformRole)).toBe("USER");
    expect(headers.get(TRUSTED_CONTEXT_HEADERS.verified)).toBe("1");
    expect(contextFromTrustedHeaders(headers)).toEqual({ businessId: "biz-1", actorUserId: "user-1", role: "ADMIN", platformRole: "USER" });
  });

  it("membuang semua header konteks saat request tidak lewat middleware", () => {
    const headers = trustedHeaders();
    clearTrustedContextHeaders(headers);

    expect(headers.get(TRUSTED_CONTEXT_HEADERS.verified)).toBeNull();
    expect(contextFromTrustedHeaders(headers)).toBeNull();
  });

  it("menolak header dengan role yang tidak dikenal", () => {
    const headers = trustedHeaders({ [TRUSTED_CONTEXT_HEADERS.role]: "SUPERUSER" });

    expect(contextFromTrustedHeaders(headers)).toBeNull();
  });

  it("menolak header dengan businessId kosong", () => {
    const headers = trustedHeaders({ [TRUSTED_CONTEXT_HEADERS.businessId]: "  " });

    expect(contextFromTrustedHeaders(headers)).toBeNull();
  });
});
