import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { beginningBalancesSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";


export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const rows = await prisma.beginningBalance.findMany({ where: { businessId }, include: { account: true }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({ id: r.id, account: `${r.account.code} ${r.account.name}`, side: r.side, amount: r.amount, status: r.status }));
  });
}

export async function POST(request: Request) { return handleApi(async () => serverServices.business.saveBeginningBalances(await validatedBody(request, beginningBalancesSchema) as any)); }
