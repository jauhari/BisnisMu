import { handleApi } from "@/presentation/api/route-handler";
import { salesPaymentSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
export async function POST(request: Request) { return handleApi(async () => serverServices.sales.service.allocatePayment(await validatedBody(request, salesPaymentSchema) as any)); }
