import { beforeEach, describe, expect, it, vi } from "vitest";

const contacts: Array<Record<string, unknown>> = [];
const cache = new Map<string, unknown>();
const cacheTags = new Map<string, string[]>();

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: string[]) => Promise<unknown>, keyParts: string[], options?: { tags?: string[] }) => async (...args: string[]) => {
    const key = JSON.stringify([...keyParts, ...args]);
    if (cache.has(key)) return cache.get(key);
    const value = await fn(...args);
    cache.set(key, value);
    cacheTags.set(key, options?.tags ?? []);
    return value;
  },
  revalidateTag: (tag: string) => {
    for (const [key, tags] of cacheTags) {
      if (tags.includes(tag)) {
        cache.delete(key);
        cacheTags.delete(key);
      }
    }
  },
}));

vi.mock("@/presentation/api/prisma", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(async () => contacts.map((contact) => ({ ...contact }))),
      create: vi.fn(async ({ data }) => {
        const contact = { id: "contact-1", isActive: true, ...data };
        contacts.push(contact);
        return contact;
      }),
    },
  },
}));

vi.mock("@/presentation/auth/session", () => ({
  requireTenantContext: vi.fn(async () => ({ businessId: "business-1", actorUserId: "user-1", role: "OWNER" })),
}));

vi.mock("@/presentation/api/route-handler", () => ({
  handleApi: async (work: () => Promise<unknown>) => Response.json({ data: await work() }),
}));

describe("contacts API", () => {
  beforeEach(() => {
    contacts.splice(0);
    cache.clear();
    cacheTags.clear();
    vi.clearAllMocks();
  });

  it("returns a contact created after the list was cached empty", async () => {
    const { GET, POST } = await import("@/../app/api/contacts/route");

    const before = await GET(new Request("http://localhost/api/contacts"));
    expect(await before.json()).toEqual({ data: [] });

    await POST(new Request("http://localhost/api/contacts", {
      method: "POST",
      body: JSON.stringify({ name: "Toko Maju", type: "CUSTOMER" }),
    }));

    const after = await GET(new Request("http://localhost/api/contacts"));
    expect(await after.json()).toMatchObject({ data: [{ id: "contact-1", name: "Toko Maju" }] });
  });
});
