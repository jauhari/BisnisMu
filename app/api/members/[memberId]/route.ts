import { handleApi } from "@/presentation/api/route-handler";
import { memberUpdateSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

type Params = { params: Promise<{ memberId: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { memberId } = await params;
    const { businessId, actorUserId } = await requireTenantContext(request);
    return serverServices.member.getDetail({ businessId, actorUserId, memberId });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { memberId } = await params;
    const body = await validatedBody(request, memberUpdateSchema);
    return serverServices.member.updateMember({ ...body, memberId });
  });
}
