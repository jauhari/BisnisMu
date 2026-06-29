import { handleApi } from "@/presentation/api/route-handler";
import { journalSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { prisma } from "@/presentation/api/prisma";
import { createJournal } from "@/presentation/accounting/journal-workflows";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await validatedBody(request, journalSchema);
    return createJournal(prisma, { businessId: body.businessId, actorUserId: body.actorUserId }, body, "DRAFT");
  });
}