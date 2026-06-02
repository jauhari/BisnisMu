import { handleApi } from "@/presentation/api/route-handler";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaClient } from "@prisma/client";
const repo = new PrismaInventoryRepository(new PrismaClient());
export async function GET(request: Request) {
  return handleApi(async () => repo.listBalances(await requireTenantContext(request)));
}
