import type { ApiModule } from "./contracts";

export interface EndpointContract { module: ApiModule; method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; service: string; operation: string; }

export const endpointRegistry: EndpointContract[] = [
  { module: "dashboard", method: "POST", path: "/api/dashboard/overview", service: "DashboardService", operation: "getDashboardOverview" },
  { module: "reports", method: "POST", path: "/api/reports/general-ledger", service: "ReportingService", operation: "generateGeneralLedger" },
  { module: "reports", method: "POST", path: "/api/reports/trial-balance", service: "ReportingService", operation: "generateTrialBalance" },
  { module: "reports", method: "POST", path: "/api/reports/profit-loss", service: "ReportingService", operation: "generateProfitLoss" },
  { module: "reports", method: "POST", path: "/api/reports/balance-sheet", service: "ReportingService", operation: "generateBalanceSheet" },
  { module: "reports", method: "POST", path: "/api/reports/cash-flow", service: "ReportingService", operation: "generateCashFlow" },
  { module: "business", method: "POST", path: "/api/business", service: "BusinessService", operation: "createBusiness" },
  { module: "business", method: "PATCH", path: "/api/business/settings", service: "BusinessService", operation: "updateSettings" },
  { module: "business", method: "POST", path: "/api/business/fiscal-periods/open", service: "BusinessService", operation: "openFiscalPeriod" },
  { module: "business", method: "POST", path: "/api/business/fiscal-periods/close", service: "BusinessService", operation: "closeFiscalPeriod" },
  { module: "chart-of-accounts", method: "GET", path: "/api/chart-of-accounts", service: "ChartOfAccountsService", operation: "list" },
  { module: "chart-of-accounts", method: "POST", path: "/api/chart-of-accounts", service: "ChartOfAccountsService", operation: "create" },
  { module: "accounting", method: "POST", path: "/api/accounting/journals", service: "JournalPostingService", operation: "post" },
  { module: "cash", method: "POST", path: "/api/cash/transactions/preview", service: "CashManagementService", operation: "preview" },
  { module: "cash", method: "POST", path: "/api/cash/transactions", service: "CashManagementService", operation: "createDraft" },
  { module: "cash", method: "POST", path: "/api/cash/transactions/post", service: "CashManagementService", operation: "post" },
  { module: "ar-ap", method: "POST", path: "/api/ar-ap/invoices", service: "ArApService", operation: "createInvoice" },
  { module: "ar-ap", method: "POST", path: "/api/ar-ap/bills", service: "ArApService", operation: "createBill" },
  { module: "payment", method: "POST", path: "/api/payment/allocate", service: "PaymentService", operation: "allocatePayment" },
  { module: "float", method: "POST", path: "/api/float/top-up", service: "FloatManagementService", operation: "topupFloat" },
  { module: "inventory", method: "POST", path: "/api/inventory/products", service: "InventoryService", operation: "createProduct" },
  { module: "inventory", method: "PATCH", path: "/api/inventory/products/[id]", service: "InventoryService", operation: "updateProduct" },
  { module: "purchase", method: "POST", path: "/api/purchase/orders", service: "PurchaseService", operation: "createPurchaseOrder" },
  { module: "sales", method: "POST", path: "/api/sales/orders", service: "SalesService", operation: "createSalesOrder" },
  { module: "pos", method: "POST", path: "/api/pos/checkout", service: "PosService", operation: "checkoutTransaction" }
];

export function endpointsFor(module: ApiModule): EndpointContract[] { return endpointRegistry.filter((endpoint) => endpoint.module === module); }
