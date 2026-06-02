import { handleApi } from "@/presentation/api/route-handler";
import { inventoryStockInSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) { return handleApi(async () => serverServices.inventory.service.stockIn(await validatedBody(request, inventoryStockInSchema) as any)); }
