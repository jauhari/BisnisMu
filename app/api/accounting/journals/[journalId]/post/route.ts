import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";
import { postDraftJournal } from "@/presentation/accounting/journal-workflows";

export async function POST(request: Request, { params }: { params: Promise<{ journalId: string }> }) {
  return handleApi(async () => {
    const [{ journalId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    return postDraftJournal(prisma, { businessId: tenant.businessId, actorUserId: tenant.actorUserId }, journalId);
  });
}