import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { normalizeCashTransaction, normalizeDailySale, normalizeSalesOrder } from "@/presentation/transactions/history";
import { AuthError } from "@/presentation/auth/auth-error";
import { canHardMutateOrganizationTransaction, canReadTransaction, organizationHardMutationEnabled } from "@/presentation/auth/permissions";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    const tenant = await requireTenantContext(request);
    if (!canReadTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");

    const [business, cashTransactions, dailySales, salesOrders] = await Promise.all([
      prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } }),
      // Keep the history list broad enough to include manually entered cash
      // transactions alongside the legacy-import rows. The secondary order
      // is important because many imported rows share the same date.
      prisma.cashTransaction.findMany({
        where: { businessId: tenant.businessId },
        select: {
          id: true,
          transactionNumber: true,
          transactionDate: true,
          type: true,
          status: true,
          amount: true,
          description: true,
        },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: 500,
      }),
      prisma.dailySale.findMany({
        where: { businessId: tenant.businessId },
        select: {
          id: true,
          saleDate: true,
          status: true,
          description: true,
          totalAmount: true,
          items: {
            select: {
              revenueAccount: { select: { name: true } },
            },
            orderBy: { lineNo: "asc" },
            take: 1,
          },
        },
        orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: 500,
      }),
      prisma.salesOrder.findMany({
        where: { businessId: tenant.businessId },
        select: {
          id: true,
          salesNumber: true,
          saleDate: true,
          status: true,
          description: true,
          totalAmount: true,
          paidAmount: true,
        },
        orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: 500,
      }),
    ]);

    const rows = [
      ...dailySales.map(normalizeDailySale),
      ...salesOrders.map(normalizeSalesOrder),
      ...cashTransactions.map(normalizeCashTransaction),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return { role: tenant.role, hardMutation: canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings)), rows };
  });
}
