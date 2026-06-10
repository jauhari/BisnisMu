import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";
import { z } from "zod";

const addSchema = z.object({ businessId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId } = await params;
    const { businessId } = addSchema.parse(await request.json());
    await orgServices.organization.addUnit(actorUserId, orgId, businessId);
    return { attached: true, orgId, businessId };
  });
}
