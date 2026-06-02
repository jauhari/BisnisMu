import { prisma } from "./prisma";
import { JournalPostingService } from "@/features/accounting/application/journal-posting-service";
import { PrismaJournalRepository } from "@/features/accounting/infrastructure/prisma-journal-repository";
import { ArApService } from "@/features/ar-ap/application/ar-ap-service";
import { PrismaArApRepository } from "@/features/ar-ap/infrastructure/prisma-ar-ap-repository";
import { BusinessService } from "@/features/business/application/business-service";
import { PrismaBusinessRepository } from "@/features/business/infrastructure/prisma-business-repository";
import { CashManagementService } from "@/features/cash-management/application/cash-service";
import { PrismaCashRepository } from "@/features/cash-management/infrastructure/prisma-cash-repository";
import { CashService } from "@/features/cash/application/cash-service";
import { PrismaCashSessionRepository } from "@/features/cash/infrastructure/prisma-cash-session-repository";
import { ChartOfAccountsService } from "@/features/chart-of-accounts/application/chart-of-accounts-service";
import { PrismaChartOfAccountsRepository } from "@/features/chart-of-accounts/infrastructure/prisma-chart-of-accounts-repository";
import { ReportingService } from "@/features/reporting/application/reporting-service";
import { PaymentService } from "@/features/payment/application/payment-service";
import { PrismaPaymentRepository } from "@/features/payment/infrastructure/prisma-payment-repository";
import { SalesService } from "@/features/sales/application/sales-service";
import { PrismaSalesRepository } from "@/features/sales/infrastructure/prisma-sales-repository";
import { PrismaReportingRepository } from "@/features/reporting/infrastructure/prisma-reporting-repository";
import { InventoryService } from "@/features/inventory/application/inventory-service";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
import { PurchaseService } from "@/features/purchase/application/purchase-service";
import { PrismaPurchaseRepository } from "@/features/purchase/infrastructure/prisma-purchase-repository";
import { PosService } from "@/features/pos/application/pos-service";
import { PrismaPosRepository } from "@/features/pos/infrastructure/prisma-pos-repository";
import { FloatManagementService } from "@/features/float/application/float-service";
import { PrismaFloatRepository } from "@/features/float/infrastructure/prisma-float-repository";
import { RevenueService } from "@/features/revenue/application/revenue-service";
import { PrismaRevenueRepository } from "@/features/revenue/infrastructure/prisma-revenue-repository";
import { TourismService } from "@/features/tourism/application/tourism-service";
import { PrismaTourismRepository } from "@/features/tourism/infrastructure/prisma-tourism-repository";

const journalRepository = new PrismaJournalRepository(prisma);
const journal = new JournalPostingService(journalRepository);
const businessRepository = new PrismaBusinessRepository(prisma);
const chartRepository = new PrismaChartOfAccountsRepository(prisma);
const cashRepository = new PrismaCashRepository(prisma);
const cashSessionRepository = new PrismaCashSessionRepository(prisma);
const arApRepository = new PrismaArApRepository(prisma);
const reportingRepository = new PrismaReportingRepository(prisma);
const paymentRepository = new PrismaPaymentRepository(prisma);
const salesRepository = new PrismaSalesRepository(prisma);
const inventoryRepository = new PrismaInventoryRepository(prisma);
const purchaseRepository = new PrismaPurchaseRepository(prisma);
const floatRepository = new PrismaFloatRepository(prisma);
const payment = new PaymentService(paymentRepository, journal);
const inventory = new InventoryService(inventoryRepository, journal);
const arAp = new ArApService(arApRepository, journal);
const cashSession = new CashService(cashSessionRepository, journal);
const float = new FloatManagementService(floatRepository, journal);
const sales = new SalesService(salesRepository, journal, inventory, payment);
const posRepository = new PrismaPosRepository(prisma);
const pos = new PosService(posRepository, sales, payment, cashSession);
const revenueRepository = new PrismaRevenueRepository(prisma);
const revenue = new RevenueService(revenueRepository, journal);
const tourismRepository = new PrismaTourismRepository(prisma);
const tourism = new TourismService(tourismRepository, revenue);

export const serverServices = {
  journal,
  business: new BusinessService(businessRepository, journal),
  chartOfAccounts: new ChartOfAccountsService(chartRepository),
  cashManagement: new CashManagementService(cashRepository, journal),
  cashSession,
  arAp,
  payment,
  float,
  reporting: new ReportingService(reportingRepository, reportingRepository),
  sales: { service: sales, repo: salesRepository },
  inventory: { service: inventory, repo: inventoryRepository },
  purchase: new PurchaseService(purchaseRepository, journal, inventory, arAp),
  pos,
  revenue,
  tourism,
  paymentRepository
};
