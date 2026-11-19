import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { id } = await params;
    const tenant = await requireTenantContext(request);
    return serverServices.business.closeFiscalPeriod({ ...tenant, fiscalPeriodId: id });
  });
}
