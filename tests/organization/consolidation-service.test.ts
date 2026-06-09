import { describe, expect, it } from "vitest";
import { ConsolidationService } from "../../src/features/organization/application/consolidation-service";
import type { OrganizationRepository } from "../../src/features/organization/application/organization-repository";
import type { OrgRole } from "../../src/features/organization/domain/organization-types";
import type { ReportingService } from "../../src/features/reporting/application/reporting-service";
import type { IncomeStatementReport, StatementSection } from "../../src/features/reporting/domain/reporting-types";

function section(code: string, name: string, amount: bigint): StatementSection {
  return { lines: amount > 0n ? [{ accountId: code, accountCode: code, accountName: name, amount }] : [], total: amount };
}

function pnl(businessId: string, revenue: bigint, cogs: bigint, expenses: bigint): IncomeStatementReport {
  const grossProfit = revenue - cogs;
  return {
    businessId,
    startsOn: new Date("2026-01-01"),
    endsOn: new Date("2026-01-31"),
    revenue: section("410101", "Penjualan", revenue),
    cogs: section("510101", "HPP", cogs),
    expenses: section("610201", "Beban", expenses),
    otherExpenses: section("710101", "Beban Lain", 0n),
    grossProfit,
    netIncome: grossProfit - expenses,
  };
}

const UNIT_PNL: Record<string, IncomeStatementReport> = {
  "unit-sp": pnl("unit-sp", 12_500n, 0n, 3_200n), // net 9_300, margin 74.4%
  "unit-pw": pnl("unit-pw", 16_000n, 0n, 4_100n), // net 11_900, margin 74.4%
  "unit-pd": pnl("unit-pd", 8_700n, 5_200n, 1_800n), // net 1_700, margin 19.5%
};

function makeRepo(role: OrgRole | null): OrganizationRepository {
  return {
    getMember: async (_orgId: string, _userId: string) =>
      role ? { organizationId: _orgId, userId: _userId, role, joinedAt: new Date() } : null,
    getBusinessUnits: async () => [
      { id: "unit-sp", name: "Unit Simpan Pinjam", type: "BUMDES" },
      { id: "unit-pw", name: "Unit Pariwisata", type: "BUMDES" },
      { id: "unit-pd", name: "Unit Perdagangan", type: "BUMDES" },
    ],
  } as unknown as OrganizationRepository;
}

const reportingStub = {
  generateProfitAndLoss: async (cmd: { businessId: string }) => UNIT_PNL[cmd.businessId]!,
} as unknown as ReportingService;

const range = { startsOn: new Date("2026-01-01"), endsOn: new Date("2026-01-31") };

describe("ConsolidationService", () => {
  it("menolak non-anggota", async () => {
    const svc = new ConsolidationService(makeRepo(null), reportingStub);
    await expect(svc.getConsolidatedIncomeStatement("user-x", "org-1", range)).rejects.toThrow();
  });

  it("mengkonsolidasi laba rugi semua unit", async () => {
    const svc = new ConsolidationService(makeRepo("ORG_OWNER"), reportingStub);
    const result = await svc.getConsolidatedIncomeStatement("user-1", "org-1", range);
    expect(result.units).toHaveLength(3);
    expect(result.consolidated.revenue.total).toBe(37_200n);
    expect(result.consolidated.netIncome).toBe(22_900n);
  });

  it("perbandingan unit dengan status kesehatan", async () => {
    const svc = new ConsolidationService(makeRepo("ORG_VIEWER"), reportingStub);
    const cmp = await svc.getUnitComparison("user-1", "org-1", range);
    expect(cmp.totalRevenue).toBe(37_200n);
    expect(cmp.totalNetProfit).toBe(22_900n);
    const pd = cmp.units.find((u) => u.businessId === "unit-pd");
    const sp = cmp.units.find((u) => u.businessId === "unit-sp");
    expect(sp?.healthStatus).toBe("HEALTHY");
    expect(pd?.healthStatus).toBe("WATCH");
  });
});
