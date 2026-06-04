import { handleApi } from "@/presentation/api/route-handler";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { z } from "zod";

const schema = z.object({ reason: z.string().min(5, "Alasan minimal 5 karakter") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { id } = await params;
    const tenant = await requireTenantContext(request);
    const { reason } = schema.parse(await request.json());
    return serverServices.business.reopenFiscalPeriod({ ...tenant, fiscalPeriodId: id, reason });
  });
}
