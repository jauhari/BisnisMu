import { revalidateTag, unstable_cache } from "next/cache";

import { CONTACTS_CACHE_TAG } from "@/presentation/cache/tags";
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

function serializeContact<T extends { totalRevenue?: bigint | string | number }>(contact: T) {
  return { ...contact, totalRevenue: String(contact.totalRevenue ?? 0) };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const params = new URL(request.url).searchParams;
    const q = params.get("q") ?? "";
    const id = params.get("id");
    // Direct lookup by id (used to resolve the configured default customer).
    if (id) {
      const contacts = await prisma.contact.findMany({ where: { businessId, isActive: true, id } });
      return contacts.map(serializeContact);
    }

    const getCachedContacts = unstable_cache(
      async (bizId: string, search: string) => {
        const contacts = await prisma.contact.findMany({
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
        });
        return contacts.map(serializeContact);
      },
      ["contacts", businessId, q],
      { revalidate: 60, tags: [CONTACTS_CACHE_TAG] }
    );

    return getCachedContacts(businessId, q);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const { name, category, picName, phone, email, address, type } = createSchema.parse(await request.json());
    const contact = await prisma.contact.create({
      data: { businessId, name, category, picName: picName ?? null, phone: phone ?? null, email: email ?? null, address: address ?? null, type },
    });
    revalidateTag(CONTACTS_CACHE_TAG);
    return serializeContact(contact);
  });
}
