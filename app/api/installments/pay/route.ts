import { handleApi } from "@/presentation/api/route-handler";
import { installmentPaySchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) {
  return handleApi(async () => serverServices.installments.payInstallment(await validatedBody(request, installmentPaySchema) as any));
}
