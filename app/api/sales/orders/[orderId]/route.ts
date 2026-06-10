import { handleApi } from "@/presentation/api/route-handler";
import { salesOrderSchema } from "@/presentation/api/request-schemas";
import { parseAndValidate } from "@/presentation/api/validation";
import { prisma } from "@/presentation/api/prisma";
import { serverServices } from "@/presentation/api/server-services";
import { AuthError } from "@/presentation/auth/auth-error";
import { canDeleteDraftTransaction, canHardMutateOrganizationTransaction, canMutateTransactionDraft, canReadTransaction, organizationHardMutationEnabled } from "@/presentation/auth/permissions";
import { requireTenantContext } from "@/presentation/auth/session";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return handleApi(async () => {
    const [{ orderId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    if (!canReadTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    const order = await serverServices.sales.repo.findSalesOrder(tenant as any, orderId);
    if (!order) throw new Error("Sales order was not found.");
    return order;
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return handleApi(async () => {
    const [{ orderId }, tenant, body] = await Promise.all([params, requireTenantContext(request), parseAndValidate(request, salesOrderSchema)]);
    const business = await prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } });
    if (canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings))) return serverServices.sales.service.updateAnySalesOrder({ ...body, businessId: tenant.businessId, actorUserId: tenant.actorUserId, salesOrderId: orderId } as any);
    if (!canMutateTransactionDraft(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    return serverServices.sales.service.updateSalesOrder({ ...body, businessId: tenant.businessId, actorUserId: tenant.actorUserId, salesOrderId: orderId } as any);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  return handleApi(async () => {
    const [{ orderId }, tenant] = await Promise.all([params, requireTenantContext(request)]);
    const business = await prisma.business.findUnique({ where: { id: tenant.businessId }, select: { organization: { select: { settings: true } } } });
    if (canHardMutateOrganizationTransaction(tenant.role, organizationHardMutationEnabled(business?.organization?.settings))) return serverServices.sales.service.deleteAnySalesOrder({ businessId: tenant.businessId, actorUserId: tenant.actorUserId, salesOrderId: orderId });
    if (!canDeleteDraftTransaction(tenant.role)) throw new AuthError("FORBIDDEN", "Forbidden");
    return serverServices.sales.service.deleteSalesOrder({ businessId: tenant.businessId, actorUserId: tenant.actorUserId, salesOrderId: orderId });
  });
}
