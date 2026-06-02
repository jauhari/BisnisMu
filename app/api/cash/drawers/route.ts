import { handleApi } from "@/presentation/api/route-handler";
import { cashDrawerSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { PrismaClient } from "@prisma/client";
import { requireTenantContext } from "@/presentation/auth/session";
const prisma = new PrismaClient();
export async function POST(request: Request) { return handleApi(async () => { const { businessId } = await requireTenantContext(request); const body = await parseAndValidate(request, cashDrawerSchema); return prisma.cashDrawer.create({ data: { businessId, name: body.name, cashAccountId: body.cashAccountId } }); }); }
export async function GET(request: Request) { return handleApi(async () => { const { businessId } = await requireTenantContext(request); return prisma.cashDrawer.findMany({ where: { businessId }, orderBy: { name: "asc" } }); }); }
