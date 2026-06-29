import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ORG_OWNER", "ORG_ADMIN", "ORG_VIEWER"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId } = await params;
    const { email, role } = inviteSchema.parse(await request.json());
    return orgServices.organization.inviteMember(actorUserId, orgId, email, role);
  });
}
