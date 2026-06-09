import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";
import { z } from "zod";

const rangeSchema = z.object({
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId } = await params;
    const body = rangeSchema.parse(await request.json());
    return orgServices.consolidation.getConsolidatedBalanceSheet(actorUserId, orgId, {
      startsOn: new Date(body.startsOn),
      endsOn: new Date(body.endsOn),
    });
  });
}
