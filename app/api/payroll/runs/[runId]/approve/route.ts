import { handleApi } from "@/presentation/api/route-handler";
import { payrollApproveSchema } from "@/presentation/api/request-schemas";
import { serverServices } from "@/presentation/api/server-services";
import { parseAndValidate } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  return handleApi(async () => {
    const [{ runId }, body, tenant] = await Promise.all([params, parseAndValidate(request, payrollApproveSchema), requireTenantContext(request)]);
    return serverServices.payroll.approveRun({ ...tenant, payrollRunId: runId, approvedAt: body.approvedAt ?? new Date() });
  });
}
