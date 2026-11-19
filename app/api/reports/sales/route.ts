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
    const orders = await prisma.salesOrder.findMany({
      where: { businessId, saleDate: { gte: startsOn!, lte: endsOn! } },
      include: { items: true },
      orderBy: { saleDate: "desc" }
    });
    return engine.generateSalesReport({ businessId, startsOn: startsOn!, endsOn: endsOn! }, orders as any);
  });
}
