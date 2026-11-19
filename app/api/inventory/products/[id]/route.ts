import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { inventoryProductSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { PrismaInventoryRepository } from "@/features/inventory/infrastructure/prisma-inventory-repository";
const repo = new PrismaInventoryRepository(prisma);
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; return handleApi(async () => repo.findProduct(await requireTenantContext(request), id)); }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; return handleApi(async () => serverServices.inventory.service.updateProduct({ ...(await validatedBody(request, inventoryProductSchema)), productId: id } as any)); }
