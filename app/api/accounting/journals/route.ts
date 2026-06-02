import { handleApi } from "@/presentation/api/route-handler";
import { journalSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, journalSchema);
    return serverServices.journal.post({
      businessId: body.businessId,
      actorUserId: body.actorUserId,
      transactionDate: body.transactionDate,
      source: body.source,
      description: body.description,
      ...(body.sourceId ? { sourceId: body.sourceId } : {}),
      ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
      lines: body.lines,
    });
  });
}
