import { handleApi } from "@/presentation/api/route-handler";
import { selectBusinessSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { selectActiveBusiness } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await parseAndValidate(request, selectBusinessSchema);
    await selectActiveBusiness(request, body.businessId);
    return { activeBusinessId: body.businessId };
  });
}
