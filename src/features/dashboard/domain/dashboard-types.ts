import { Bill, Customer, Invoice, Payment as ArApPayment, Vendor } from "../../ar-ap/domain/ar-ap-types";
import { CashTransactionEntity } from "../../cash-management/domain/cash-types";
import { FloatAccountEntity, FloatTransactionEntity } from "../../float/domain/float-types";
import { InventoryBalanceEntity, InventoryMovementEntity, ProductCategoryEntity, ProductEntity } from "../../inventory/domain/inventory-types";
import { CustomerWalletEntity, PaymentTransactionEntity } from "../../payment/domain/payment-types";
import { PurchaseOrderEntity } from "../../purchase/domain/purchase-types";
import { CashFlowReport, ProfitAndLossReport } from "../../reporting/domain/reporting-types";
import { SalesOrderEntity } from "../../sales/domain/sales-types";

export interface DashboardDateRange { businessId: string; startsOn: Date; endsOn: Date; asOf?: Date; lowStockThreshold?: bigint; lowFloatThreshold?: bigint; }
export interface DashboardEntity { businessId: string; }
export interface RankedAmount { id: string; name: string; amount: bigint; count: number; quantity?: bigint; }
export interface LowStockItem { productId: string; sku: string; name: string; quantity: bigint; inventoryValue: bigint; }
export interface LowFloatProvider { provider: string; balance: bigint; accountCount: number; }

export interface DashboardInput {
  salesOrders?: SalesOrderEntity[];
  purchaseOrders?: PurchaseOrderEntity[];
  products?: ProductEntity[];
  productCategories?: ProductCategoryEntity[];
  inventoryBalances?: InventoryBalanceEntity[];
  inventoryMovements?: InventoryMovementEntity[];
  cashTransactions?: CashTransactionEntity[];
  floatAccounts?: FloatAccountEntity[];
  floatTransactions?: FloatTransactionEntity[];
  customers?: Customer[];
  vendors?: Vendor[];
  invoices?: Invoice[];
  bills?: Bill[];
  arApPayments?: ArApPayment[];
  paymentTransactions?: PaymentTransactionEntity[];
  customerWallets?: CustomerWalletEntity[];
  profitAndLoss?: ProfitAndLossReport;
  cashFlow?: CashFlowReport;
  cashBalances?: Array<{ businessId: string; accountId: string; subtype: "cash" | "bank"; balance: bigint }>;
}

export interface SalesDashboardAnalytics { salesToday: bigint; salesThisMonth: bigint; salesGrowth: bigint; topProducts: RankedAmount[]; topCategories: RankedAmount[]; }
export interface ProfitabilityDashboardAnalytics { grossProfit: bigint; netProfit: bigint; profitMargin: number; }
export interface CashDashboardAnalytics { cashOnHand: bigint; bankBalance: bigint; cashFlowToday: bigint; }
export interface ReceivableDashboardAnalytics { totalReceivable: bigint; overdueReceivable: bigint; }
export interface PayableDashboardAnalytics { totalPayable: bigint; overduePayable: bigint; }
export interface InventoryDashboardAnalytics { inventoryValue: bigint; lowStockItems: LowStockItem[]; fastMovingItems: RankedAmount[]; slowMovingItems: RankedAmount[]; }
export interface FloatDashboardAnalytics { totalFloatBalance: bigint; floatUsageToday: bigint; lowFloatProviders: LowFloatProvider[]; }
export interface CustomerDashboardAnalytics { activeCustomers: number; topCustomers: RankedAmount[]; customerDepositBalance: bigint; }
export interface VendorDashboardAnalytics { topVendors: RankedAmount[]; vendorOutstandingBalance: bigint; }

export interface DashboardOverview {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
  sales: SalesDashboardAnalytics;
  profitability: ProfitabilityDashboardAnalytics;
  cash: CashDashboardAnalytics;
  receivable: ReceivableDashboardAnalytics;
  payable: PayableDashboardAnalytics;
  inventory: InventoryDashboardAnalytics;
  float: FloatDashboardAnalytics;
  customer: CustomerDashboardAnalytics;
  vendor: VendorDashboardAnalytics;
  salesTrend: Array<{ label: string; value: number }>;
  cashTrend: Array<{ label: string; value: number }>;
}

export class DashboardError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "DashboardError";
  }
}
