import { handleApi } from "@/presentation/api/route-handler";
import { payrollRunSchema } from "@/presentation/api/request-schemas";
import { serverServices } from "@/presentation/api/server-services";
import { parseAndValidate } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  return handleApi(async () => {
    const [{ runId }, body, tenant] = await Promise.all([params, parseAndValidate(request, payrollRunSchema), requireTenantContext(request)]);
    return serverServices.payroll.updateDraftRun({
      ...tenant,
      payrollRunId: runId,
      ...body,
      items: body.items.map((item) => ({ employeeId: item.employeeId, salaryAmount: item.salaryAmount, incentiveAmount: item.incentiveAmount ?? 0n, deductionAmount: item.deductionAmount ?? 0n, ...(item.notes ? { notes: item.notes } : {}) })),
    });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  return handleApi(async () => {
    const [{ runId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    await serverServices.payroll.deleteDraftRun({ ...tenant, payrollRunId: runId });
    return { deleted: true };
  });
}
