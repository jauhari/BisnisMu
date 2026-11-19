import { handleApi } from "@/presentation/api/route-handler";
import { journalSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";
import { deleteDraftJournal, updateDraftJournal } from "@/presentation/accounting/journal-workflows";

export async function PUT(request: Request, { params }: { params: Promise<{ journalId: string }> }) {
  return handleApi(async () => {
    const [{ journalId }, body] = await Promise.all([params, validatedBody(request, journalSchema)]);
    return updateDraftJournal(prisma, { businessId: body.businessId, actorUserId: body.actorUserId }, journalId, body);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ journalId: string }> }) {
  return handleApi(async () => {
    const [{ journalId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    return deleteDraftJournal(prisma, { businessId: tenant.businessId, actorUserId: tenant.actorUserId }, journalId);
  });
}