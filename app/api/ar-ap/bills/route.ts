import { handleApi } from "@/presentation/api/route-handler";
import { billSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, billSchema);
    return serverServices.arAp.createBill({
      businessId: body.businessId,
      actorUserId: body.actorUserId,
      vendorId: body.vendorId,
      issueDate: body.issueDate,
      dueDate: body.dueDate ?? body.issueDate,
      apAccountId: body.apAccountId,
      expenseAccountId: body.expenseAccountId ?? body.apAccountId,
      subtotal: body.amount ?? 0n,
      description: body.description ?? "",
    } as any);
  });
}
