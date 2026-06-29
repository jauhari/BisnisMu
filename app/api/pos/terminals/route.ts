import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { posTerminalSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";
export async function POST(request: Request) { return handleApi(async () => { const { businessId } = await requireTenantContext(request); const body = await parseAndValidate(request, posTerminalSchema); return prisma.posTerminal.create({ data: { businessId, name: body.name, cashDrawerId: body.cashDrawerId ?? null } }); }); }
export async function GET(request: Request) { return handleApi(async () => { const { businessId } = await requireTenantContext(request); return prisma.posTerminal.findMany({ where: { businessId }, orderBy: { name: "asc" } }); }); }
