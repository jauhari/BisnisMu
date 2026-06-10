import { handleApi } from "@/presentation/api/route-handler";
import { installmentPlanSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => serverServices.installments.listPlans(await requireTenantContext(request)));
}

export async function POST(request: Request) {
  return handleApi(async () => serverServices.installments.createPlan(await validatedBody(request, installmentPlanSchema) as any));
}
