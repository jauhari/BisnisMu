import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";
import { z } from "zod";

const roleSchema = z.object({ role: z.enum(["ORG_OWNER", "ORG_ADMIN", "ORG_VIEWER"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string; userId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId, userId } = await params;
    const { role } = roleSchema.parse(await request.json());
    return orgServices.organization.updateMemberRole(actorUserId, orgId, userId, role);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string; userId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId, userId } = await params;
    await orgServices.organization.removeMember(actorUserId, orgId, userId);
    return { removed: true, orgId, userId };
  });
}
