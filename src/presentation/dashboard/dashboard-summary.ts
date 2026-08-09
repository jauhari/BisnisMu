import { unstable_cache } from "next/cache";

import { prisma } from "@/presentation/api/prisma";

export interface DashboardSummaryInput {
  businessId: string;
  startsOn: Date;
  endsOn: Date;
}

export interface DashboardSummary {
  salesToday: bigint;
  netProfit: bigint;
  profitMargin: number;
  cashOnHand: bigint;
  bankBalance: bigint;
  inventoryValue: bigint;
  lowStockCount: number;
  overdueReceivable: bigint;
  lowFloatProvider: string | null;
  salesTrend: Array<{ label: string; value: number }>;
  cashTrend: Array<{ label: string; value: number }>;
}

type TrendItem = { date: Date; amount: bigint };

function signedAmount(side: "DEBIT" | "CREDIT", amount: bigint, normalSide: "DEBIT" | "CREDIT"): bigint {
  return side === normalSide ? amount : -amount;
}

function formatDay(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]}`;
}

function trendPoints(startsOn: Date, endsOn: Date, items: TrendItem[]): Array<{ label: string; value: number }> {
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor((endsOn.getTime() - startsOn.getTime()) / dayMs) + 1;
  const byBucket = new Map<string, bigint>();
  const labels = new Map<string, string>();

  if (days > 186) {
    const cursor = new Date(Date.UTC(startsOn.getUTCFullYear(), startsOn.getUTCMonth(), 1));
    while (cursor <= endsOn) {
      const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
      byBucket.set(key, 0n);
      labels.set(key, `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    for (const item of items) {
      const key = `${item.date.getUTCFullYear()}-${item.date.getUTCMonth()}`;
      byBucket.set(key, (byBucket.get(key) ?? 0n) + item.amount);
    }
  } else {
    const bucketDays = days <= 31 ? 1 : 7;
    for (let offset = 0; offset < days; offset += bucketDays) {
      const bucketStart = new Date(startsOn.getTime() + offset * dayMs);
      const key = String(offset / bucketDays);
      byBucket.set(key, 0n);
      labels.set(key, bucketDays === 1 ? formatDay(bucketStart) : `W${Number(key) + 1}`);
    }
    for (const item of items) {
      const offset = Math.floor((item.date.getTime() - startsOn.getTime()) / dayMs);
      if (offset < 0 || offset >= days) continue;
      const key = String(Math.floor(offset / bucketDays));
      byBucket.set(key, (byBucket.get(key) ?? 0n) + item.amount);
    }
  }

  return [...byBucket.entries()].map(([key, amount]) => ({ label: labels.get(key) ?? key, value: Number(amount) }));
}

function calculateProfitability(lines: Array<{ side: "DEBIT" | "CREDIT"; amount: bigint; account: { groupCode: string } }>): Pick<DashboardSummary, "netProfit" | "profitMargin"> {
  let revenue = 0n;
  let cogs = 0n;
  let expenses = 0n;

  for (const line of lines) {
    if (line.account.groupCode === "REVENUE") revenue += signedAmount(line.side, line.amount, "CREDIT");
    if (line.account.groupCode === "COGS") cogs += signedAmount(line.side, line.amount, "DEBIT");
    if (line.account.groupCode === "EXPENSE" || line.account.groupCode === "OTHER_EXPENSE") expenses += signedAmount(line.side, line.amount, "DEBIT");
  }

  const netProfit = revenue - cogs - expenses;
  return { netProfit, profitMargin: revenue === 0n ? 0 : Number((netProfit * 10_000n) / revenue) / 100 };
}

async function loadDashboardSummary(input: DashboardSummaryInput): Promise<DashboardSummary> {
  const { businessId, startsOn, endsOn } = input;
  const [salesOrders, cashTransactions, inventoryTotals, lowStockCount, overdueInvoices, floatAccounts, periodLedgerLines, cashLedgerLines] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { businessId, saleDate: { gte: startsOn, lte: endsOn }, status: { not: "VOID" } },
      select: { saleDate: true, totalAmount: true },
    }),
    prisma.cashTransaction.findMany({
      where: { businessId, transactionDate: { gte: startsOn, lte: endsOn }, status: "POSTED" },
      select: { transactionDate: true, type: true, amount: true },
    }),
    prisma.inventoryBalance.aggregate({ where: { businessId }, _sum: { inventoryValue: true } }),
    prisma.inventoryBalance.count({ where: { businessId, quantity: { lte: 5n } } }),
    prisma.invoice.findMany({
      where: { businessId, dueDate: { lt: endsOn }, status: { notIn: ["PAID", "VOID"] } },
      select: { subtotal: true, paidAmount: true },
    }),
    prisma.floatAccount.findMany({ where: { businessId }, select: { provider: true, currentBalance: true } }),
    prisma.journalLine.findMany({
      where: { businessId, journal: { businessId, status: "POSTED", transactionDate: { gte: startsOn, lte: endsOn } } },
      select: { side: true, amount: true, account: { select: { groupCode: true } } },
    }),
    prisma.journalLine.findMany({
      where: { businessId, journal: { businessId, status: "POSTED", transactionDate: { lte: endsOn } }, account: { subtype: { in: ["cash", "bank"] } } },
      select: { side: true, amount: true, account: { select: { subtype: true } } },
    }),
  ]);

  const todayKey = endsOn.toISOString().slice(0, 10);
  const salesToday = salesOrders
    .filter((order) => order.saleDate.toISOString().slice(0, 10) === todayKey)
    .reduce((total, order) => total + order.totalAmount, 0n);
  const { netProfit, profitMargin } = calculateProfitability(periodLedgerLines);

  let cashOnHand = 0n;
  let bankBalance = 0n;
  for (const line of cashLedgerLines) {
    const balance = signedAmount(line.side, line.amount, "DEBIT");
    if (line.account.subtype === "cash") cashOnHand += balance;
    if (line.account.subtype === "bank") bankBalance += balance;
  }

  const providerBalances = new Map<string, bigint>();
  for (const account of floatAccounts) providerBalances.set(account.provider, (providerBalances.get(account.provider) ?? 0n) + account.currentBalance);
  const lowFloatProvider = [...providerBalances.entries()].filter(([, balance]) => balance <= 100n).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0].localeCompare(b[0])))[0]?.[0] ?? null;

  return {
    salesToday,
    netProfit,
    profitMargin,
    cashOnHand,
    bankBalance,
    inventoryValue: inventoryTotals._sum.inventoryValue ?? 0n,
    lowStockCount,
    overdueReceivable: overdueInvoices.reduce((total, invoice) => total + (invoice.subtotal - invoice.paidAmount), 0n),
    lowFloatProvider,
    salesTrend: trendPoints(startsOn, endsOn, salesOrders.map((order) => ({ date: order.saleDate, amount: order.totalAmount }))),
    cashTrend: trendPoints(startsOn, endsOn, cashTransactions.map((transaction) => ({ date: transaction.transactionDate, amount: transaction.type === "CASH_IN" ? transaction.amount : -transaction.amount }))),
  };
}

export const getCachedDashboardSummary = unstable_cache(loadDashboardSummary, ["dashboard-summary"], { revalidate: 30, tags: ["dashboard"] });
