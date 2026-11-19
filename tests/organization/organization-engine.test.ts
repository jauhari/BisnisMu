import { describe, expect, it } from "vitest";
import { OrganizationEngine } from "../../src/features/organization/domain/organization-engine";
import type { IncomeStatementReport, StatementSection } from "../../src/features/reporting/domain/reporting-types";

const engine = new OrganizationEngine();

function section(lines: Array<[string, string, bigint]>): StatementSection {
  const mapped = lines.map(([accountCode, accountName, amount]) => ({ accountId: accountCode, accountCode, accountName, amount }));
  return { lines: mapped, total: mapped.reduce((s, l) => s + l.amount, 0n) };
}

function pnl(businessId: string, revenue: bigint, cogs: bigint, expenses: bigint): IncomeStatementReport {
  const grossProfit = revenue - cogs;
  const netIncome = grossProfit - expenses;
  return {
    businessId,
    startsOn: new Date("2026-01-01"),
    endsOn: new Date("2026-01-31"),
    revenue: section([["410101", "Penjualan", revenue]]),
    cogs: section(cogs > 0n ? [["510101", "HPP", cogs]] : []),
    expenses: section(expenses > 0n ? [["610201", "Beban", expenses]] : []),
    otherExpenses: section([]),
    grossProfit,
    netIncome,
  };
}

describe("OrganizationEngine — validasi & permission", () => {
  it("menolak nama terlalu pendek", () => {
    expect(() => engine.validateName("ab")).toThrow();
    expect(engine.validateName("  BUMDes Hanyukupi  ")).toBe("BUMDes Hanyukupi");
  });

  it("memetakan OrgRole ke BusinessRole (cascade)", () => {
    expect(engine.businessRoleFor("ORG_OWNER")).toBe("ADMIN");
    expect(engine.businessRoleFor("ORG_ADMIN")).toBe("ADMIN");
    expect(engine.businessRoleFor("ORG_VIEWER")).toBe("VIEWER");
  });

  it("permission unit & org sesuai peran", () => {
    expect(engine.canAddUnit("ORG_ADMIN")).toBe(true);
    expect(engine.canAddUnit("ORG_VIEWER")).toBe(false);
    expect(engine.canRemoveUnit("ORG_ADMIN")).toBe(false);
    expect(engine.canRemoveUnit("ORG_OWNER")).toBe(true);
    expect(engine.canDeleteOrg("ORG_ADMIN")).toBe(false);
    expect(engine.canViewReports("ORG_VIEWER")).toBe(true);
  });
});

describe("OrganizationEngine — kesehatan unit", () => {
  it("menghitung status kesehatan berdasarkan margin", () => {
    expect(engine.healthStatus(1000n, 400n)).toBe("HEALTHY"); // 40%
    expect(engine.healthStatus(1000n, 200n)).toBe("WATCH"); // 20%
    expect(engine.healthStatus(1000n, 50n)).toBe("CRITICAL"); // 5%
    expect(engine.healthStatus(1000n, -100n)).toBe("CRITICAL"); // rugi
    expect(engine.healthStatus(0n, 0n)).toBe("NO_DATA");
  });

  it("marginBps presisi", () => {
    expect(engine.marginBps(1000n, 250n)).toBe(2500);
    expect(engine.marginBps(0n, 100n)).toBe(0);
  });
});

describe("OrganizationEngine — agregasi konsolidasi", () => {
  it("menjumlahkan baris berdasarkan accountCode lintas unit", () => {
    const merged = engine.mergeSections([
      section([["410101", "Penjualan", 100n], ["410102", "Jasa", 50n]]),
      section([["410101", "Penjualan", 200n]]),
    ]);
    expect(merged.total).toBe(350n);
    const penjualan = merged.lines.find((l) => l.accountCode === "410101");
    expect(penjualan?.amount).toBe(300n);
    expect(merged.lines).toHaveLength(2);
  });

  it("mengkonsolidasi laba rugi beberapa unit", () => {
    const reports = [
      pnl("unit-a", 12_500n, 0n, 3_200n), // net 9_300
      pnl("unit-b", 8_700n, 5_200n, 1_800n), // net 1_700
      pnl("unit-c", 16_000n, 0n, 4_100n), // net 11_900
    ];
    const consolidated = engine.aggregateIncomeStatements("org-1", { startsOn: new Date("2026-01-01"), endsOn: new Date("2026-01-31") }, reports);
    expect(consolidated.revenue.total).toBe(37_200n);
    expect(consolidated.cogs.total).toBe(5_200n);
    expect(consolidated.expenses.total).toBe(9_100n);
    expect(consolidated.netIncome).toBe(22_900n);
    expect(consolidated.businessId).toBe("org-1");
  });

  it("agregasi unit kosong menghasilkan nol", () => {
    const consolidated = engine.aggregateIncomeStatements("org-1", { startsOn: new Date(), endsOn: new Date() }, []);
    expect(consolidated.revenue.total).toBe(0n);
    expect(consolidated.netIncome).toBe(0n);
  });
});
