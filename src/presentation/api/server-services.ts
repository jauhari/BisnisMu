import { prisma } from "./prisma";
import { DbClient, isRetryablePostgresError } from "@/features/shared/infrastructure/db-client";
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

/**
 * Builds the whole service graph on one database handle. Called once at module load for
 * the pooled client, and again per transaction by {@link inTransaction} so that a
 * multi-step operation runs against a single transaction handle end to end.
 */
export function buildServices(db: DbClient) {
  const journalRepository = new PrismaJournalRepository(db);
  const journal = new JournalPostingService(journalRepository);
  const businessRepository = new PrismaBusinessRepository(db);
  const chartRepository = new PrismaChartOfAccountsRepository(db);
  const cashRepository = new PrismaCashRepository(db);
  const cashSessionRepository = new PrismaCashSessionRepository(db);
  const arApRepository = new PrismaArApRepository(db);
  const reportingRepository = new PrismaReportingRepository(db);
  const paymentRepository = new PrismaPaymentRepository(db);
  const salesRepository = new PrismaSalesRepository(db);
  const inventoryRepository = new PrismaInventoryRepository(db);
  const purchaseRepository = new PrismaPurchaseRepository(db);
  const floatRepository = new PrismaFloatRepository(db);
  const payment = new PaymentService(paymentRepository, journal);
  const inventory = new InventoryService(inventoryRepository, journal);
  const arAp = new ArApService(arApRepository, journal);
  const float = new FloatManagementService(floatRepository, journal);
  const cashSession = new CashService(cashSessionRepository, journal);
  const sales = new SalesService(salesRepository, journal, inventory, payment);
  const posRepository = new PrismaPosRepository(db);
  const pos = new PosService(posRepository, sales, payment, cashSession);
  const revenueRepository = new PrismaRevenueRepository(db);
  const revenue = new RevenueService(revenueRepository, journal);
  const tourismRepository = new PrismaTourismRepository(db);
  const tourism = new TourismService(tourismRepository, revenue);

  return {
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
}

export type ServerServices = ReturnType<typeof buildServices>;

export const serverServices = buildServices(prisma);

/**
 * Runs a multi-step operation as one database transaction: every write inside `work`
 * commits together or not at all. Use it wherever a single business action posts a
 * journal and then updates the document it belongs to — a partial write there leaves the
 * ledger and the document disagreeing.
 *
 * Retries the whole unit of work on transient conflicts (document-number races,
 * serialization failures, deadlocks), since a retry inside an aborted PostgreSQL
 * transaction cannot succeed.
 */
export async function inTransaction<T>(work: (services: ServerServices) => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await prisma.$transaction((tx) => work(buildServices(tx)), { timeout: 30000, maxWait: 10000 });
    } catch (error) {
      if (isRetryablePostgresError(error) && attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Transaction failed after " + attempts + " attempts.");
}
