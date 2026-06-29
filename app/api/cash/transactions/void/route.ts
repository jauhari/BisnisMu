import { handleApi } from "@/presentation/api/route-handler";
import { cashVoidSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { AuthError } from "@/presentation/auth/auth-error";
import { canVoidPostedTransaction } from "@/presentation/auth/permissions";
import { requireTenantContext } from "@/presentation/auth/session";

export async function POST(request: Request) {
  return handleApi(async () => {
    const [tenant, body] = await Promise.all([requireTenantContext(request), validatedBody(request, cashVoidSchema)]);
    if (!canVoidPostedTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    return serverServices.cashManagement.void(body as any);
  });
}
