import { revalidateTag } from "next/cache";

import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { CHART_OF_ACCOUNTS_CACHE_TAG } from "@/presentation/cache/tags";

export async function POST(request: Request) {
  return handleApi(async () => {
    const result = await serverServices.chartOfAccounts.seedSakEmkm(await requireTenantContext(request));
    revalidateTag(CHART_OF_ACCOUNTS_CACHE_TAG);
    return result;
  });
}
