import { handleApi } from "@/presentation/api/route-handler";
import { posCartAddSchema, posCartDeleteSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) { return handleApi(async () => serverServices.pos.addCartItem(await validatedBody(request, posCartAddSchema) as any)); }
export async function DELETE(request: Request) { return handleApi(async () => serverServices.pos.removeCartItem(await validatedBody(request, posCartDeleteSchema) as any)); }
