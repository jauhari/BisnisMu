import { handleApi } from "@/presentation/api/route-handler";
import { idOnlySchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) { return handleApi(async () => serverServices.arAp.postInvoice(await validatedBody(request, idOnlySchema("invoiceId")) as any)); }
