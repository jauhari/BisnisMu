import { z } from "zod";

import { handleApi } from "@/presentation/api/route-handler";
import { parseAndValidate } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { AuthError } from "@/presentation/auth/auth-error";
import { canVoidPostedTransaction } from "@/presentation/auth/permissions";
import { requireTenantContext } from "@/presentation/auth/session";

const voidSchema = z.object({ reason: z.string().min(10) });

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return handleApi(async () => {
    const [{ orderId }, tenant, body] = await Promise.all([params, requireTenantContext(request), parseAndValidate(request, voidSchema)]);
    if (!canVoidPostedTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    return serverServices.sales.service.voidSalesOrder({ businessId: tenant.businessId, actorUserId: tenant.actorUserId, salesOrderId: orderId, reason: body.reason });
  });
}
