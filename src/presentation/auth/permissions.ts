import { AuthError } from "./auth-error";
import type { AuthenticatedUserContext } from "./session";

export type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "CASHIER" | "VIEWER";
export type Permission =
  | "tenant:manage"
  | "settings:write"
  | "journal:write"
  | "coa:write"
  | "reports:read"
  | "ar:write"
  | "ap:write"
  | "inventory:write"
  | "pos:write"
  | "cash:write"
  | "sales:write"
  | "payment:write"
  | "revenue:write"
  | "tourism:write"
  | "dashboard:read";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set([
    "tenant:manage",
    "settings:write",
    "journal:write",
    "coa:write",
    "reports:read",
    "ar:write",
    "ap:write",
    "inventory:write",
    "pos:write",
    "cash:write",
    "sales:write",
    "payment:write",
    "revenue:write",
    "tourism:write",
    "dashboard:read",
  ]),
  ADMIN: new Set([
    "settings:write",
    "journal:write",
    "coa:write",
    "reports:read",
    "ar:write",
    "ap:write",
    "inventory:write",
    "pos:write",
    "cash:write",
    "sales:write",
    "payment:write",
    "revenue:write",
    "tourism:write",
    "dashboard:read",
  ]),
  ACCOUNTANT: new Set(["journal:write", "coa:write", "reports:read", "ar:write", "ap:write", "inventory:write", "revenue:write", "dashboard:read"]),
  CASHIER: new Set(["pos:write", "cash:write", "sales:write", "revenue:write", "tourism:write", "dashboard:read"]),
  VIEWER: new Set(["reports:read", "dashboard:read"]),
};

export interface RoutePermissionRule {
  pattern: string;
  permission: Permission;
  methods?: readonly string[];
}

export const ROUTE_PERMISSION_RULES: readonly RoutePermissionRule[] = [
  { pattern: "/api/auth/select-business", permission: "reports:read", methods: ["POST"] },
  { pattern: "/api/settings", permission: "settings:write" },
  { pattern: "/api/dashboard", permission: "dashboard:read" },
  { pattern: "/api/reports", permission: "reports:read" },
  { pattern: "/api/accounting/chart-of-accounts", permission: "coa:write" },
  { pattern: "/api/accounting/journals", permission: "journal:write" },
  { pattern: "/api/accounting/beginning-balances", permission: "journal:write" },
  { pattern: "/api/accounting/fiscal-periods", permission: "journal:write" },
  { pattern: "/api/accounting/audit", permission: "reports:read", methods: ["GET"] },
  { pattern: "/api/ar-ap/customers", permission: "ar:write" },
  { pattern: "/api/ar-ap/invoices", permission: "ar:write" },
  { pattern: "/api/ar-ap/receivables", permission: "ar:write" },
  { pattern: "/api/ar-ap/vendors", permission: "ap:write" },
  { pattern: "/api/ar-ap/bills", permission: "ap:write" },
  { pattern: "/api/ar-ap/payables", permission: "ap:write" },
  { pattern: "/api/ar-ap/payments", permission: "payment:write" },
  { pattern: "/api/installments", permission: "ar:write" },
  { pattern: "/api/settings/members", permission: "tenant:manage" },
  { pattern: "/api/contacts", permission: "ar:write" },
  { pattern: "/api/inventory", permission: "inventory:write" },
  { pattern: "/api/purchase", permission: "ap:write" },
  { pattern: "/api/float", permission: "cash:write" },
  { pattern: "/api/cash", permission: "cash:write" },
  { pattern: "/api/pos", permission: "pos:write" },
  { pattern: "/api/sales", permission: "sales:write" },
  { pattern: "/api/payment", permission: "payment:write" },
  { pattern: "/api/revenue", permission: "revenue:write" },
  { pattern: "/api/tourism", permission: "tourism:write" },
];

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function requireRole(context: Pick<AuthenticatedUserContext, "role">, allowedRoles: readonly Role[]): void {
  if (!allowedRoles.includes(context.role)) throw new AuthError("FORBIDDEN", "Forbidden");
}

export function requirePermission(context: Pick<AuthenticatedUserContext, "role">, permission: Permission): void {
  if (!hasPermission(context.role, permission)) throw new AuthError("FORBIDDEN", "Forbidden");
}

export function permissionForRoute(pathname: string, method = "GET"): Permission | null {
  const normalizedMethod = method.toUpperCase();
  const rule = ROUTE_PERMISSION_RULES.find((candidate) => {
    const methodMatches = !candidate.methods || candidate.methods.includes(normalizedMethod);
    return methodMatches && (pathname === candidate.pattern || pathname.startsWith(candidate.pattern + "/"));
  });
  return rule?.permission ?? null;
}

export function requirePermissionForRoute(context: Pick<AuthenticatedUserContext, "role">, pathname: string, method = "GET"): void {
  const permission = permissionForRoute(pathname, method);
  if (!permission) throw new AuthError("FORBIDDEN", "Forbidden");
  requirePermission(context, permission);
}
