import { unstable_cache } from "next/cache";

import { prisma } from "@/presentation/api/prisma";
import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { z } from "zod";

const createSchema = z.object({
  name:     z.string().min(1),
  category: z.enum(["INDIVIDUAL", "INSTANSI"]).default("INDIVIDUAL"),
  picName:  z.string().optional(),
  phone:    z.string().optional(),
  email:    z.string().optional(),
  address:  z.string().optional(),
  type:     z.enum(["CUSTOMER", "SUPPLIER", "BOTH", "OTHER"]).default("CUSTOMER"),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const params = new URL(request.url).searchParams;
    const q = params.get("q") ?? "";
    const id = params.get("id");
    // Direct lookup by id (used to resolve the configured default customer).
    if (id) {
      return prisma.contact.findMany({ where: { businessId, isActive: true, id } });
    }

    const getCachedContacts = unstable_cache(
      async (bizId: string, search: string) => prisma.contact.findMany({
        where: {
          businessId: bizId,
          isActive: true,
          ...(search ? {
            OR: [
              { name:    { contains: search, mode: "insensitive" } },
              { picName: { contains: search, mode: "insensitive" } },
              { phone:   { contains: search } },
            ],
          } : {}),
        },
        orderBy: { name: "asc" },
        take: 100,
      }),
      ["contacts", businessId, q],
      { revalidate: 60 }
    );

    return getCachedContacts(businessId, q);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const { name, category, picName, phone, email, address, type } = createSchema.parse(await request.json());
    return prisma.contact.create({
      data: { businessId, name, category, picName: picName ?? null, phone: phone ?? null, email: email ?? null, address: address ?? null, type },
    });
  });
}
