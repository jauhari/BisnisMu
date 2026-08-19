import { revalidateTag } from "next/cache";

import { handleApi } from "@/presentation/api/route-handler";
import { selectBusinessSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { setDefaultBusiness } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await parseAndValidate(request, selectBusinessSchema);
    await setDefaultBusiness(request, body.businessId);
    revalidateTag("businesses");
    return { defaultBusinessId: body.businessId };
  });
}
