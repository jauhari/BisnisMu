import { handleApi } from "@/presentation/api/route-handler";
import { inventoryProductSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
import { PrismaClient } from "@prisma/client";
const repo = new PrismaInventoryRepository(new PrismaClient());
export async function GET(request: Request) { return handleApi(async () => repo.listProducts(await requireTenantContext(request))); }
export async function POST(request: Request) { return handleApi(async () => serverServices.inventory.service.createProduct(await validatedBody(request, inventoryProductSchema) as any)); }
