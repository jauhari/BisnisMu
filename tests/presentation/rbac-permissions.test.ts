import { describe, expect, it } from "vitest";

import { canDeleteDraftTransaction, canHardMutateOrganizationTransaction, canMutateTransactionDraft, canReadTransaction, canVoidPostedTransaction, hasPermission, permissionForRoute, requirePermission, requirePermissionForRoute, requireRole, type Role } from "../../src/presentation/auth/permissions";

function context(role: Role) {
  return { role };
}

describe("RBAC permissions", () => {
  it("allows owner full access", () => {
    expect(() => requirePermissionForRoute(context("OWNER"), "/api/settings", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("OWNER"), "/api/pos/checkout", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("OWNER"), "/api/reports/profit-loss", "POST")).not.toThrow();
    expect(() => requireRole(context("OWNER"), ["OWNER"])).not.toThrow();
  });

  it("allows admin broad access except tenant ownership changes", () => {
    expect(() => requirePermissionForRoute(context("ADMIN"), "/api/accounting/journals", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ADMIN"), "/api/payment/allocate", "POST")).not.toThrow();
    expect(hasPermission("ADMIN", "tenant:manage")).toBe(false);
    expect(() => requirePermission(context("ADMIN"), "tenant:manage")).toThrow(/Forbidden/);
  });

  it("restricts accountant to accounting, reports, AR/AP, and inventory", () => {
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/accounting/chart-of-accounts", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/reports/balance-sheet", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/ar-ap/invoices", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/inventory/products", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/pos/checkout", "POST")).toThrow(/Forbidden/);
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/cash/transactions", "POST")).toThrow(/Forbidden/);
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/cash/transactions", "GET")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/sales/orders/list", "GET")).not.toThrow();
  });

  it("restricts cashier to POS, cash transactions, and sales orders", () => {
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/pos/checkout", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/cash/transactions", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/sales/orders", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/revenue/transactions", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/tourism/visitor-transactions", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/reports/scan", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/accounting/chart-of-accounts", "GET")).not.toThrow();
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/accounting/chart-of-accounts", "POST")).toThrow(/Forbidden/);
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/reports/profit-loss", "POST")).toThrow(/Forbidden/);
    expect(() => requirePermissionForRoute(context("CASHIER"), "/api/inventory/products", "POST")).toThrow(/Forbidden/);
  });

  it("restricts viewer to read-only reports", () => {
    expect(() => requirePermissionForRoute(context("VIEWER"), "/api/reports/cash-flow", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("VIEWER"), "/api/dashboard/overview", "POST")).not.toThrow();
    expect(() => requirePermissionForRoute(context("VIEWER"), "/api/cash/transactions", "GET")).not.toThrow();
    expect(() => requirePermissionForRoute(context("VIEWER"), "/api/sales/orders/list", "GET")).not.toThrow();
    expect(() => requirePermissionForRoute(context("VIEWER"), "/api/sales/orders", "POST")).toThrow(/Forbidden/);
    expect(() => requirePermissionForRoute(context("VIEWER"), "/api/accounting/journals", "POST")).toThrow(/Forbidden/);
  });

  it("maps routes to module permissions", () => {
    expect(permissionForRoute("/api/accounting/journals", "POST")).toBe("journal:write");
    expect(permissionForRoute("/api/accounting/chart-of-accounts", "POST")).toBe("coa:write");
    expect(permissionForRoute("/api/ar-ap/invoices/post", "POST")).toBe("ar:write");
    expect(permissionForRoute("/api/ar-ap/bills/post", "POST")).toBe("ap:write");
    expect(permissionForRoute("/api/pos/cart", "POST")).toBe("pos:write");
    expect(permissionForRoute("/api/revenue/transactions/post", "POST")).toBe("revenue:write");
    expect(permissionForRoute("/api/tourism/visitor-transactions", "POST")).toBe("tourism:write");
    expect(permissionForRoute("/api/unknown", "GET")).toBeNull();
  });

  it("separates transaction CRUD capabilities by role", () => {
    expect(canReadTransaction("VIEWER")).toBe(true);
    expect(canReadTransaction("ACCOUNTANT")).toBe(true);
    expect(canMutateTransactionDraft("CASHIER")).toBe(true);
    expect(canMutateTransactionDraft("ACCOUNTANT")).toBe(false);
    expect(canDeleteDraftTransaction("CASHIER")).toBe(false);
    expect(canDeleteDraftTransaction("ADMIN")).toBe(true);
    expect(canVoidPostedTransaction("CASHIER")).toBe(false);
    expect(canVoidPostedTransaction("OWNER")).toBe(true);
  });

  it("allows hard transaction mutation only above cashier when organization setting enables it", () => {
    expect(canHardMutateOrganizationTransaction("OWNER", true)).toBe(true);
    expect(canHardMutateOrganizationTransaction("ADMIN", true)).toBe(true);
    expect(canHardMutateOrganizationTransaction("ACCOUNTANT", true)).toBe(true);
    expect(canHardMutateOrganizationTransaction("CASHIER", true)).toBe(false);
    expect(canHardMutateOrganizationTransaction("VIEWER", true)).toBe(false);
    expect(canHardMutateOrganizationTransaction("OWNER", false)).toBe(false);
  });

  it("lets read roles reach transaction mutation routes for business-specific guards", () => {
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/cash/transactions/cash-1", "PATCH")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/cash/transactions/cash-1", "DELETE")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/sales/orders/order-1", "PATCH")).not.toThrow();
    expect(() => requirePermissionForRoute(context("ACCOUNTANT"), "/api/sales/daily/sale-1", "DELETE")).not.toThrow();
    expect(() => requirePermissionForRoute(context("VIEWER"), "/api/sales/daily/sale-1", "PATCH")).not.toThrow();
  });
});
