import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { serverServices } from "@/presentation/api/server-services";
import { CHART_OF_ACCOUNTS_CACHE_TAG } from "@/presentation/cache/tags";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const updateAccountSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().min(1).nullable().optional(),
  subtype: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  return handleApi(async () => {
    const [{ accountId }, tenant, body] = await Promise.all([params, requireTenantContext(request), request.json()]);
    const data = updateAccountSchema.parse(body);
    const command: { businessId: string; actorUserId: string; accountId: string; name?: string; description?: string | null; subtype?: string | null; isActive?: boolean } = { businessId: tenant.businessId, actorUserId: tenant.actorUserId, accountId };
    if (data.name !== undefined) command.name = data.name;
    if (data.description !== undefined) command.description = data.description;
    if (data.subtype !== undefined) command.subtype = data.subtype;
    if (data.isActive !== undefined) command.isActive = data.isActive;
    const account = await serverServices.chartOfAccounts.update(command);
    revalidateTag(CHART_OF_ACCOUNTS_CACHE_TAG);
    return account;
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  return handleApi(async () => {
    const [{ accountId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    const result = await serverServices.chartOfAccounts.delete({ ...tenant, accountId });
    revalidateTag(CHART_OF_ACCOUNTS_CACHE_TAG);
    return result;
  });
}
