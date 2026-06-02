import { handleApi } from "@/presentation/api/route-handler";
import { reportRequestSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { PrismaClient } from "@prisma/client";
import { ReportingEngine } from "@/features/reporting";
import { requireTenantContext } from "@/presentation/auth/session";

const prisma = new PrismaClient();
const engine = new ReportingEngine();

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await parseAndValidate(request, reportRequestSchema);
    const { businessId } = await requireTenantContext(request);
    const startsOn = body.command.startsOn ? new Date(body.command.startsOn) : undefined;
    const endsOn = body.command.endsOn ? new Date(body.command.endsOn) : undefined;
    const [accounts, transactions, snapshots] = await Promise.all([
      prisma.floatAccount.findMany({ where: { businessId } }),
      prisma.floatTransaction.findMany({ where: { businessId, transactionDate: { gte: startsOn!, lte: endsOn! } }, orderBy: { transactionDate: "desc" } }),
      prisma.floatBalanceSnapshot.findMany({ where: { businessId, snapshotDate: { gte: startsOn!, lte: endsOn! } }, orderBy: { snapshotDate: "desc" } })
    ]);
    return engine.generateFloatReport({ businessId, startsOn: startsOn!, endsOn: endsOn! }, { accounts: accounts as any, transactions: transactions as any, snapshots: snapshots as any });
  });
}
