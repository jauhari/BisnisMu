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
    const [products, balances, movements] = await Promise.all([
      prisma.product.findMany({ where: { businessId } }),
      prisma.inventoryBalance.findMany({ where: { businessId } }),
      prisma.inventoryMovement.findMany({ where: { businessId, movementDate: { gte: startsOn!, lte: endsOn! } }, orderBy: { movementDate: "desc" } })
    ]);
    return engine.generateInventoryReport({ businessId, startsOn: startsOn!, endsOn: endsOn! }, { products: products as any, balances: balances as any, movements: movements as any });
  });
}
