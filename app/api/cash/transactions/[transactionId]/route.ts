import { handleApi } from "@/presentation/api/route-handler";
import { cashTransactionSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { prisma } from "@/presentation/api/prisma";
import { serverServices } from "@/presentation/api/server-services";
import { AuthError } from "@/presentation/auth/auth-error";
import { canDeleteDraftTransaction, canHardMutateOrganizationTransaction, canMutateTransactionDraft, canReadTransaction, organizationHardMutationEnabled } from "@/presentation/auth/permissions";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  return handleApi(async () => {
    const [{ transactionId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    if (!canReadTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    const transaction = await prisma.cashTransaction.findFirst({ where: { id: transactionId, businessId: tenant.businessId } });
    if (!transaction) throw new Error("Cash transaction was not found.");
    return transaction;
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  return handleApi(async () => {
    const [{ transactionId }, tenant, body] = await Promise.all([params, requireTenantContext(request), parseAndValidate(request, cashTransactionSchema)]);
    const business = await prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } });
    if (canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings))) return serverServices.cashManagement.updateAny({ ...body, businessId: tenant.businessId, actorUserId: tenant.actorUserId, transactionId } as any);
    if (!canMutateTransactionDraft(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    return serverServices.cashManagement.updateDraft({ ...body, businessId: tenant.businessId, actorUserId: tenant.actorUserId, transactionId } as any);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  return handleApi(async () => {
    const [{ transactionId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    const business = await prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } });
    if (canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings))) return serverServices.cashManagement.deleteAny({ businessId: tenant.businessId, actorUserId: tenant.actorUserId, transactionId });
    if (!canDeleteDraftTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    return serverServices.cashManagement.deleteDraft({ businessId: tenant.businessId, actorUserId: tenant.actorUserId, transactionId });
  });
}
