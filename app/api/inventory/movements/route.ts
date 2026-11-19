import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
const repo = new PrismaInventoryRepository(prisma);
import { requireTenantContext } from "@/presentation/auth/session";
export async function GET(request: Request) { return handleApi(async () => { return repo.listMovements(await requireTenantContext(request)); }); }
