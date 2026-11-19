import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";
import { AuthError } from "@/presentation/auth/auth-error";

/**
 * Period-end closing: close all revenue/expense accounts into retained earnings, then close period.
 * Posting closing entries:
 *   Revenue accounts (CREDIT normal): Dr. Revenue, Cr. Retained Earnings
 *   Expense accounts (DEBIT normal):  Cr. Expense, Dr. Retained Earnings
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { id } = await params;
    const tenant = await requireTenantContext(request);
    const { businessId, actorUserId } = tenant;

    const period = await prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period || period.businessId !== businessId) throw new AuthError("FORBIDDEN", "Periode tidak ditemukan.");
    if (period.status !== "OPEN") throw new Error("Periode sudah ditutup atau tidak dalam status OPEN.");

    const retainedEarningsAccount = await prisma.account.findFirst({
      where: { businessId, subtype: "retained_earnings", isActive: true },
    });
    if (!retainedEarningsAccount) throw new Error("Akun Saldo Laba tidak ditemukan. Pastikan COA sudah di-seed.");

    // Aggregate net balance per account for income/expense groups in this period
    const rawLines = await prisma.journalLine.findMany({
      where: {
        businessId,
        journal: {
          status: "POSTED",
          transactionDate: { gte: period.startsOn, lte: period.endsOn },
          source: { not: "PERIOD_CLOSING" }, // avoid double-closing
        },
        account: { groupCode: { in: ["REVENUE", "COGS", "EXPENSE", "OTHER_EXPENSE"] } },
      },
      select: { accountId: true, side: true, amount: true, account: { select: { groupCode: true } } },
    });

    if (rawLines.length === 0) {
      return serverServices.business.closeFiscalPeriod({ businessId, actorUserId, fiscalPeriodId: id });
    }

    // Net balance per account: debit total - credit total
    const accountMap = new Map<string, { accountId: string; groupCode: string; debit: bigint; credit: bigint }>();
    for (const l of rawLines) {
      const entry = accountMap.get(l.accountId) ?? { accountId: l.accountId, groupCode: l.account.groupCode, debit: 0n, credit: 0n };
      if (l.side === "DEBIT") entry.debit += l.amount;
      else entry.credit += l.amount;
      accountMap.set(l.accountId, entry);
    }

    const closingLines: { accountId: string; side: "DEBIT" | "CREDIT"; amount: bigint }[] = [];
    let retainedDelta = 0n; // positive = credit retained earnings (profit)

    for (const { accountId, groupCode, debit, credit } of accountMap.values()) {
      const isRevenue = groupCode === "REVENUE";
      // Revenue normal balance = CREDIT → net = credit - debit
      // Expense normal balance = DEBIT → net = debit - credit
      const netBalance = isRevenue ? credit - debit : debit - credit;
      if (netBalance <= 0n) continue;

      if (isRevenue) {
        closingLines.push({ accountId, side: "DEBIT", amount: netBalance }); // zero out revenue
        retainedDelta += netBalance; // credit retained earnings
      } else {
        closingLines.push({ accountId, side: "CREDIT", amount: netBalance }); // zero out expense
        retainedDelta -= netBalance; // debit retained earnings
      }
    }

    // Add retained earnings leg
    if (retainedDelta > 0n) {
      closingLines.push({ accountId: retainedEarningsAccount.id, side: "CREDIT", amount: retainedDelta });
    } else if (retainedDelta < 0n) {
      closingLines.push({ accountId: retainedEarningsAccount.id, side: "DEBIT", amount: -retainedDelta });
    }

    if (closingLines.length >= 2) {
      await serverServices.journal.post({
        businessId,
        actorUserId,
        transactionDate: period.endsOn,
        source: "PERIOD_CLOSING",
        sourceId: id,
        description: `Jurnal penutup periode fiskal ${period.fiscalYear}`,
        idempotencyKey: `PERIOD_CLOSING:${businessId}:${id}`,
        lines: closingLines,
      });
    }

    return serverServices.business.closeFiscalPeriod({ businessId, actorUserId, fiscalPeriodId: id });
  });
}
