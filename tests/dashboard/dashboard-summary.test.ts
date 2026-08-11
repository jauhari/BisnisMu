import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (work: (...args: any[]) => Promise<unknown>) => async (...args: any[]) => {
    const result = await work(...args);
    JSON.stringify(result);
    return result;
  },
}));

vi.mock("@/presentation/api/prisma", () => ({
  prisma: {
    salesOrder: { findMany: vi.fn().mockResolvedValue([]) },
    cashTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    inventoryBalance: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { inventoryValue: 100n } }),
      count: vi.fn().mockResolvedValue(0),
    },
    invoice: { findMany: vi.fn().mockResolvedValue([]) },
    floatAccount: { findMany: vi.fn().mockResolvedValue([]) },
    journalLine: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("getCachedDashboardSummary", () => {
  it("returns a JSON-serializable summary when it contains monetary values", async () => {
    const { getCachedDashboardSummary } = await import("@/presentation/dashboard/dashboard-summary");

    await expect(getCachedDashboardSummary({
      businessId: "business-1",
      startsOn: new Date("2026-08-01T00:00:00.000Z"),
      endsOn: new Date("2026-08-11T23:59:59.999Z"),
    })).resolves.toMatchObject({ inventoryValue: "100" });
  });
});
