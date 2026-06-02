import { handleApi } from "@/presentation/api/route-handler";
import { purchaseReceiptSchema } from "@/presentation/api/request-schemas";
import { validatedBody } from "@/presentation/api/validation";
import { serverServices } from "@/presentation/api/server-services";
import { requireTenantContext } from "@/presentation/auth/session";
export async function POST(request: Request) { return handleApi(async () => serverServices.purchase.receivePurchaseOrder(await validatedBody(request, purchaseReceiptSchema) as any)); }
export async function GET(request: Request) { return handleApi(async () => { const { PrismaClient } = await import("@prisma/client"); const prisma = new PrismaClient(); const { businessId } = await requireTenantContext(request); return prisma.purchaseReceipt.findMany({ where: { businessId }, orderBy: { receiptDate: "desc" } }); }); }
