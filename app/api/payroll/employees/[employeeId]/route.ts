import { handleApi } from "@/presentation/api/route-handler";
import { payrollEmployeeUpdateSchema } from "@/presentation/api/request-schemas";
import { serverServices } from "@/presentation/api/server-services";
import { parseAndValidate } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  return handleApi(async () => {
    const [{ employeeId }, body, tenant] = await Promise.all([params, parseAndValidate(request, payrollEmployeeUpdateSchema), requireTenantContext(request)]);
    return serverServices.payroll.updateEmployee({ ...tenant, employeeId, ...body });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  return handleApi(async () => {
    const [{ employeeId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    await serverServices.payroll.deleteEmployee({ ...tenant, employeeId });
    return { deleted: true };
  });
}
