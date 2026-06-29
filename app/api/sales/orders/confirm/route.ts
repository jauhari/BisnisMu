import { handleApi } from "@/presentation/api/route-handler";
import { idOnlySchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { AuthError } from "@/presentation/auth/auth-error";
import { canMutateTransactionDraft } from "@/presentation/auth/permissions";
import { requireTenantContext } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => {
    const [tenant, body] = await Promise.all([requireTenantContext(request), validatedBody(request, idOnlySchema("salesOrderId"))]);
    if (!canMutateTransactionDraft(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    return serverServices.sales.service.confirmSalesOrder(body as any);
  });
}
