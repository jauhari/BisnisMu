import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => serverServices.chartOfAccounts.seedSakEmkm(await requireTenantContext(request)));
}
