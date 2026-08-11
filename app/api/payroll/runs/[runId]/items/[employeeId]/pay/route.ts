import { handleApi } from "@/presentation/api/route-handler";
import { payrollItemPaySchema } from "@/presentation/api/request-schemas";
import { serverServices } from "@/presentation/api/server-services";
import { parseAndValidate } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string; employeeId: string }> }) {
  return handleApi(async () => {
    const [{ runId, employeeId }, body, tenant] = await Promise.all([params, parseAndValidate(request, payrollItemPaySchema), requireTenantContext(request)]);
    return serverServices.payroll.payItem({ ...tenant, payrollRunId: runId, employeeId, paymentAccountId: body.paymentAccountId, amount: body.amount, paidAt: body.paidAt ?? new Date() });
  });
}
