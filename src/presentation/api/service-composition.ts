import type { JournalPostingService } from "../../features/accounting/application/journal-posting-service";
import type { ArApService } from "../../features/ar-ap/application/ar-ap-service";
import type { BusinessService } from "../../features/business/application/business-service";
import type { CashManagementService } from "../../features/cash-management/application/cash-service";
import type { CashService } from "../../features/cash/application/cash-service";
import type { ChartOfAccountsService } from "../../features/chart-of-accounts/application/chart-of-accounts-service";
import type { DashboardService } from "../../features/dashboard/application/dashboard-service";
import type { FloatManagementService } from "../../features/float/application/float-service";
import type { InventoryService } from "../../features/inventory/application/inventory-service";
import type { PaymentService } from "../../features/payment/application/payment-service";
import type { PosService } from "../../features/pos/application/pos-service";
import type { PurchaseService } from "../../features/purchase/application/purchase-service";
import type { ReportingService } from "../../features/reporting/application/reporting-service";
import type { RevenueService } from "../../features/revenue/application/revenue-service";
import type { SalesService } from "../../features/sales/application/sales-service";
import type { TourismService } from "../../features/tourism/application/tourism-service";

export interface AppServiceComposition {
  accounting: JournalPostingService;
  arAp: ArApService;
  business: BusinessService;
  cashManagement: CashManagementService;
  cash?: CashService;
  chartOfAccounts: ChartOfAccountsService;
  dashboard: DashboardService;
  float: FloatManagementService;
  inventory: InventoryService;
  payment?: PaymentService;
  pos?: PosService;
  purchase?: PurchaseService;
  reporting: ReportingService;
  revenue: RevenueService;
  sales?: SalesService;
  tourism: TourismService;
}

let composition: AppServiceComposition | null = null;
export function registerAppServices(services: AppServiceComposition): void { composition = services; }
export function getAppServices(): AppServiceComposition { if (!composition) throw new Error("App service composition has not been registered."); return composition; }
export function clearAppServicesForTests(): void { composition = null; }
