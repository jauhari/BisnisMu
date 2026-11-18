import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { memberLoanSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

type Params = { params: Promise<{ memberId: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { memberId } = await params;
    const { businessId } = await requireTenantContext(request);
    return prisma.memberLoan.findMany({
      where: { businessId, memberId },
      orderBy: { disbursedOn: "desc" },
      include: { installments: { orderBy: { installmentNo: "asc" } } },
    });
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { memberId } = await params;
    const body = await validatedBody(request, memberLoanSchema);
    return serverServices.member.createLoan({ ...body, memberId });
  });
}
