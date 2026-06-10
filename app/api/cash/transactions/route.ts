import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { cashTransactionSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
export async function POST(request: Request) { return handleApi(async () => serverServices.cashManagement.createDraft(await validatedBody(request, cashTransactionSchema) as any)); }
export async function GET(request: Request) { return handleApi(async () => { const { businessId } = await requireTenantContext(request); return prisma.cashTransaction.findMany({ where: { businessId }, orderBy: { transactionDate: "desc" }, take: 50 }); }); }
