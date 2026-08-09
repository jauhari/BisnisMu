import { handleApi } from "@/presentation/api/route-handler";
import { salesPaymentSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { inTransaction } from "@/presentation/api/server-services";
export async function POST(request: Request) { return handleApi(async () => { const input = await validatedBody(request, salesPaymentSchema); return inTransaction((services) => services.sales.service.allocatePayment(input as any)); }); }
