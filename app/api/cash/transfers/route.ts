import { handleApi } from "@/presentation/api/route-handler";
import { cashTransferSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, cashTransferSchema);
    return serverServices.cashManagement.createDraft({
      ...body,
      type: "TRANSFER",
      transactionDate: body.movementDate,
      cashAccountId: body.sourceCashAccountId,
      destinationAccountId: body.destinationCashAccountId,
    });
  });
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    return prisma.cashTransaction.findMany({ where: { businessId, type: "TRANSFER" }, orderBy: { transactionDate: "desc" }, take: 50 });
  });
}
