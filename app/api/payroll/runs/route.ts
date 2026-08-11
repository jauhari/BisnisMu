import { handleApi } from "@/presentation/api/route-handler";
import { payrollRunSchema } from "@/presentation/api/request-schemas";
import { serverServices } from "@/presentation/api/server-services";
import { validatedBody } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => serverServices.payroll.listRuns(await requireTenantContext(request)));
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, payrollRunSchema);
    return serverServices.payroll.createRun({
      ...body,
      items: body.items.map((item) => ({
        employeeId: item.employeeId,
        salaryAmount: item.salaryAmount,
        incentiveAmount: item.incentiveAmount ?? 0n,
        deductionAmount: item.deductionAmount ?? 0n,
        ...(item.notes ? { notes: item.notes } : {}),
      })),
    });
  });
}
