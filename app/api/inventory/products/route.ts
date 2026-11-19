import { unstable_cache } from "next/cache";

import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { inventoryProductSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";

const repo = new PrismaInventoryRepository(prisma);

const getCachedProducts = unstable_cache(
  async (businessId: string) => repo.listProducts({ businessId } as any),
  ["inventory-products"],
  { revalidate: 60 }
);

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return getCachedProducts(businessId);
  });
}
export async function POST(request: Request) { return handleApi(async () => serverServices.inventory.service.createProduct(await validatedBody(request, inventoryProductSchema) as any)); }
