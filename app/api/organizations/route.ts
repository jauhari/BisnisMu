import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(3).max(120),
  type: z.enum(["BUMDES", "KOPERASI", "HOLDING", "FRANCHISE"]),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  npwpNumber: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    return orgServices.organization.listOrganizations(actorUserId);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const body = createSchema.parse(await request.json());
    return orgServices.organization.createOrganization(actorUserId, {
      name: body.name,
      type: body.type,
      description: body.description ?? null,
      address: body.address ?? null,
      npwpNumber: body.npwpNumber ?? null,
    });
  });
}
