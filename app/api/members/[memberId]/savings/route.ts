import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { memberSavingSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

type Params = { params: Promise<{ memberId: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { memberId } = await params;
    const { businessId } = await requireTenantContext(request);
    return prisma.memberSaving.findMany({
      where: { businessId, memberId },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { memberId } = await params;
    const body = await validatedBody(request, memberSavingSchema);
    return serverServices.member.recordSaving({ ...body, memberId });
  });
}
