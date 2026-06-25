import { unstable_cache } from "next/cache";

import { handleApi } from "@/presentation/api/route-handler";
import { chartOfAccountSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

const GROUP_CODE_MAP = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

const getCachedCoa = unstable_cache(
  async (businessId: string) => serverServices.chartOfAccounts.list({ businessId } as any),
  ["accounting-coa"],
  { revalidate: 300 }
);

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return getCachedCoa(businessId);
  });
}
export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, chartOfAccountSchema);
    return serverServices.chartOfAccounts.create({ ...body, groupCode: GROUP_CODE_MAP[body.groupCode] } as any);
  });
}
