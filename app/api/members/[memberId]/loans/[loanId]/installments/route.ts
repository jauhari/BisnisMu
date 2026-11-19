import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { memberInstallmentPaymentSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";

type Params = { params: Promise<{ memberId: string; loanId: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { loanId } = await params;
    const { businessId } = await requireTenantContext(request);
    return prisma.memberLoanInstallment.findMany({
      where: { businessId, loanId },
      orderBy: { installmentNo: "asc" },
    });
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { memberId, loanId } = await params;
    const body = await validatedBody(request, memberInstallmentPaymentSchema);
    return serverServices.member.payInstallment({ ...body, memberId, loanId });
  });
}
