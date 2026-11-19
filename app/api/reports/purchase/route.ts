import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { reportRequestSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { ReportingEngine } from "@/features/reporting";
import { requireTenantContext } from "@/presentation/auth/session";

const engine = new ReportingEngine();

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await parseAndValidate(request, reportRequestSchema);
    const { businessId } = await requireTenantContext(request);
    const startsOn = body.command.startsOn ? new Date(body.command.startsOn) : undefined;
    const endsOn = body.command.endsOn ? new Date(body.command.endsOn) : undefined;
    const [orders, receipts, returns] = await Promise.all([
      prisma.purchaseOrder.findMany({ where: { businessId, orderDate: { gte: startsOn!, lte: endsOn! } }, include: { items: true }, orderBy: { orderDate: "desc" } }),
      prisma.purchaseReceipt.findMany({ where: { businessId, receiptDate: { gte: startsOn!, lte: endsOn! } }, orderBy: { receiptDate: "desc" } }),
      prisma.purchaseReturn.findMany({ where: { businessId, returnDate: { gte: startsOn!, lte: endsOn! } }, orderBy: { returnDate: "desc" } })
    ]);
    return engine.generatePurchaseReport({ businessId, startsOn: startsOn!, endsOn: endsOn! }, { orders: orders as any, receipts: receipts as any, returns: returns as any });
  });
}
