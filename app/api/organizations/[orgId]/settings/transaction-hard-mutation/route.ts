import { z } from "zod";

import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";

const schema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const [{ orgId }, body] = await Promise.all([params, request.json().then((json) => schema.parse(json))]);
    const detail = await orgServices.organization.getOrganization(actorUserId, orgId);
    const settings = { ...(detail.settings ?? {}), transactionHardMutationEnabled: body.enabled };
    return orgServices.organization.updateOrganization(actorUserId, orgId, { settings });
  });
}
