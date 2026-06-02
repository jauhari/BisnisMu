import { handleApi } from "@/presentation/api/route-handler";
import { posTerminalSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { PrismaClient } from "@prisma/client";
import { requireTenantContext } from "@/presentation/auth/session";
const prisma = new PrismaClient();
export async function POST(request: Request) { return handleApi(async () => { const { businessId } = await requireTenantContext(request); const body = await parseAndValidate(request, posTerminalSchema); return prisma.posTerminal.create({ data: { businessId, name: body.name, cashDrawerId: body.cashDrawerId ?? null } }); }); }
export async function GET(request: Request) { return handleApi(async () => { const { businessId } = await requireTenantContext(request); return prisma.posTerminal.findMany({ where: { businessId }, orderBy: { name: "asc" } }); }); }
