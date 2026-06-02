import { handleApi } from "@/presentation/api/route-handler";
import { invoiceSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, invoiceSchema);
    return serverServices.arAp.createInvoice({
      businessId: body.businessId,
      actorUserId: body.actorUserId,
      customerId: body.customerId,
      issueDate: body.issueDate,
      dueDate: body.dueDate ?? body.issueDate,
      arAccountId: body.arAccountId,
      revenueAccountId: body.revenueAccountId,
      subtotal: body.amount ?? 0n,
      description: body.description ?? "",
    } as any);
  });
}
