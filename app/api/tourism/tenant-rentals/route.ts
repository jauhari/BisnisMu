import { handleApi } from "@/presentation/api/route-handler";
import { tenantRentalSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) {
  return handleApi(async () => serverServices.tourism.createTenantRental(await validatedBody(request, tenantRentalSchema) as any));
}
