import { handleApi } from "@/presentation/api/route-handler";
import { inventoryTransferSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaClient } from "@prisma/client";

const repo = new PrismaInventoryRepository(new PrismaClient());

export async function POST(request: Request) {
  return handleApi(async () => serverServices.inventory.service.transferStock(await validatedBody(request, inventoryTransferSchema) as any));
}

export async function GET(request: Request) {
  return handleApi(async () => repo.listMovements(await requireTenantContext(request), "TRANSFER"));
}
