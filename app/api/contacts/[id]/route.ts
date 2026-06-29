import { z } from "zod";
import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH", "OTHER"]).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  npwpNumber: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const contact = await prisma.contact.findFirst({ where: { id, businessId } });
    if (!contact) throw new Error("Kontak tidak ditemukan.");

    const updated = await prisma.contact.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.address !== undefined && { address: body.address }),
      },
    });

    return updated;
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const { id } = await params;

    const contact = await prisma.contact.findFirst({ where: { id, businessId } });
    if (!contact) throw new Error("Kontak tidak ditemukan.");

    await prisma.contact.update({ where: { id }, data: { isActive: false } });

    return { deleted: true };
  });
}
