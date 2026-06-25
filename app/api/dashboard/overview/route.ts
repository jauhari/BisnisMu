import { unstable_cache } from "next/cache";

import { DashboardEngine } from "@/features/dashboard";
import { prisma } from "@/presentation/api/prisma";
import { serverServices } from "@/presentation/api/server-services";
import { handleApi } from "@/presentation/api/route-handler";
import { dashboardRequestSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";

const engine = new DashboardEngine();

// Cache the heavy dashboard computation for 30s to make repeated views (and same filter) instant.
// Keyed by business + time range + thresholds. This dramatically improves perceived speed for the cockpit.
export const getCachedDashboardOverview = unstable_cache(
  async (input: any) => {
    // The original heavy logic (many finds + reporting + engine)
    const {
      businessId, actorUserId, startsOn, endsOn,
      lowStockThreshold = 5n,
      lowFloatThreshold = 100n,
    } = input;

    const [
      salesOrders,
      purchaseOrders,
      products,
      productCategories,
      inventoryBalances,
      inventoryMovements,
      cashTransactions,
      floatAccounts,
      floatTransactions,
      customers,
      vendors,
      invoices,
      bills,
      arApPayments,
      paymentTransactions,
      customerWallets,
      cashAccounts
    ] = await Promise.all([
      prisma.salesOrder.findMany({ where: { businessId, saleDate: { gte: startsOn, lte: endsOn } }, include: { items: true } }),
      prisma.purchaseOrder.findMany({ where: { businessId, orderDate: { gte: startsOn, lte: endsOn } }, include: { items: true } }),
      prisma.product.findMany({ where: { businessId } }),
      prisma.productCategory.findMany({ where: { businessId } }),
      prisma.inventoryBalance.findMany({ where: { businessId } }),
      prisma.inventoryMovement.findMany({ where: { businessId, movementDate: { gte: startsOn, lte: endsOn } } }),
      prisma.cashTransaction.findMany({ where: { businessId, transactionDate: { gte: startsOn, lte: endsOn }, status: "POSTED" } }),
      prisma.floatAccount.findMany({ where: { businessId } }),
      prisma.floatTransaction.findMany({ where: { businessId, transactionDate: { gte: startsOn, lte: endsOn } } }),
      prisma.customer.findMany({ where: { businessId } }),
      prisma.vendor.findMany({ where: { businessId } }),
      prisma.invoice.findMany({ where: { businessId, issueDate: { gte: startsOn, lte: endsOn } } }),
      prisma.bill.findMany({ where: { businessId, issueDate: { gte: startsOn, lte: endsOn } } }),
      prisma.payment.findMany({ where: { businessId } }),
      prisma.paymentTransaction.findMany({ where: { businessId, transactionDate: { gte: startsOn, lte: endsOn } } }),
      prisma.customerWallet.findMany({ where: { businessId } }),
      prisma.account.findMany({ where: { businessId, subtype: { in: ["cash", "bank"] }, isActive: true } })
    ]);

    let profitAndLoss;
    try {
      profitAndLoss = await serverServices.reporting.generateProfitLoss({
        businessId, actorUserId, startsOn, endsOn
      });
    } catch {
      profitAndLoss = undefined;
    }

    const cashBalanceRows = await prisma.journalLine.groupBy({
      by: ["accountId"],
      where: { businessId, account: { subtype: { in: ["cash", "bank"] } } },
      _sum: { amount: true }
    });
    const cashBalances = cashAccounts.map((acc) => {
      const row = cashBalanceRows.find((r) => r.accountId === acc.id);
      return { businessId, accountId: acc.id, subtype: acc.subtype as "cash" | "bank", balance: row?._sum?.amount ?? 0n };
    });

    const range = { businessId, startsOn, endsOn, asOf: new Date(), lowStockThreshold, lowFloatThreshold };
    const engineInput = {
      salesOrders: salesOrders as any,
      purchaseOrders: purchaseOrders as any,
      products: products as any,
      productCategories: productCategories as any,
      inventoryBalances: inventoryBalances as any,
      inventoryMovements: inventoryMovements as any,
      cashTransactions: cashTransactions as any,
      floatAccounts: floatAccounts as any,
      floatTransactions: floatTransactions as any,
      customers: customers as any,
      vendors: vendors as any,
      invoices: invoices as any,
      bills: bills as any,
      arApPayments: arApPayments as any,
      paymentTransactions: paymentTransactions as any,
      customerWallets: customerWallets as any,
      profitAndLoss: profitAndLoss as any,
      cashBalances
    };

    return engine.getDashboardOverview(range, engineInput);
  },
  ["dashboard-overview"],
  { revalidate: 30, tags: ["dashboard"] }
);

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await parseAndValidate(request, dashboardRequestSchema);
    const { businessId, actorUserId } = await requireTenantContext(request);
    const startsOn = body.startsOn;
    const endsOn = body.endsOn;
    const lowStockThreshold = body.lowStockThreshold ?? 5n;
    const lowFloatThreshold = body.lowFloatThreshold ?? 100n;

    // Use the cached version — this is the big win for "sat set".
    // Subsequent loads with same params within 30s are nearly instant (no 15+ queries).
    return getCachedDashboardOverview({
      businessId,
      actorUserId,
      startsOn,
      endsOn,
      lowStockThreshold,
      lowFloatThreshold,
    });
  });
}
