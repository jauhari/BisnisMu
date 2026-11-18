import { handleApi } from "@/presentation/api/route-handler";
import { memberSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId, actorUserId } = await requireTenantContext(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const statusParam = url.searchParams.get("status");
    const status = statusParam === "ACTIVE" || statusParam === "INACTIVE" || statusParam === "RESIGNED" ? statusParam : undefined;

    return serverServices.member.listOverviews({
      businessId,
      actorUserId,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => serverServices.member.createMember(await validatedBody(request, memberSchema)));
}
