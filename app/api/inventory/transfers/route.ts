import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { inventoryTransferSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
const repo = new PrismaInventoryRepository(prisma);
import { requireTenantContext } from "@/presentation/auth/session";


export async function POST(request: Request) {
  return handleApi(async () => serverServices.inventory.service.transferStock(await validatedBody(request, inventoryTransferSchema) as any));
}

export async function GET(request: Request) {
  return handleApi(async () => repo.listMovements(await requireTenantContext(request), "TRANSFER"));
}
