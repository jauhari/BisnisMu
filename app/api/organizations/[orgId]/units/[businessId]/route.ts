import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string; businessId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId, businessId } = await params;
    await orgServices.organization.removeUnit(actorUserId, orgId, businessId);
    return { detached: true, orgId, businessId };
  });
}
