import { handleApi } from "@/presentation/api/route-handler";
import { payrollEmployeeSchema } from "@/presentation/api/request-schemas";
import { serverServices } from "@/presentation/api/server-services";
import { validatedBody } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => serverServices.payroll.listEmployees(await requireTenantContext(request)));
}

export async function POST(request: Request) {
  return handleApi(async () => serverServices.payroll.createEmployee(await validatedBody(request, payrollEmployeeSchema)));
}
