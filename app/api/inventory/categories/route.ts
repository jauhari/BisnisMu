import { handleApi } from "@/presentation/api/route-handler";
import { productCategorySchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const repo = new PrismaInventoryRepository(prisma);

export async function GET(request: Request) {
  return handleApi(async () => repo.listCategories(await requireTenantContext(request)));
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const body = await parseAndValidate(request, productCategorySchema);
    return prisma.productCategory.create({
      data: { businessId, name: body.name.trim(), parentId: body.parentId ?? null, description: body.description ?? null },
    });
  });
}
