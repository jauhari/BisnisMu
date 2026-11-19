import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => serverServices.payroll.getOverview(await requireTenantContext(request)));
}
