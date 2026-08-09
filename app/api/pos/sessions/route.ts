import { handleApi } from "@/presentation/api/route-handler";
import { posSessionSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { inTransaction } from "@/presentation/api/server-services";

export async function POST(request: Request) { return handleApi(async () => { const input = await validatedBody(request, posSessionSchema); return inTransaction((services) => services.pos.openPosSession(input as any)); }); }
