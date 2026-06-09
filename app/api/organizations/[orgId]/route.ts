import { handleApi } from "@/presentation/api/route-handler";
import { orgServices } from "@/presentation/api/server-services";
import { requireActorUserId } from "@/presentation/auth/session";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  type: z.enum(["BUMDES", "KOPERASI", "HOLDING", "FRANCHISE"]).optional(),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  npwpNumber: z.string().nullable().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId } = await params;
    return orgServices.organization.getOrganization(actorUserId, orgId);
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId } = await params;
    const body = updateSchema.parse(await request.json());
    const patch: Parameters<typeof orgServices.organization.updateOrganization>[2] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.type !== undefined) patch.type = body.type;
    if (body.description !== undefined) patch.description = body.description;
    if (body.address !== undefined) patch.address = body.address;
    if (body.npwpNumber !== undefined) patch.npwpNumber = body.npwpNumber;
    return orgServices.organization.updateOrganization(actorUserId, orgId, patch);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handleApi(async () => {
    const actorUserId = await requireActorUserId(request);
    const { orgId } = await params;
    await orgServices.organization.deleteOrganization(actorUserId, orgId);
    return { deleted: true, orgId };
  });
}
