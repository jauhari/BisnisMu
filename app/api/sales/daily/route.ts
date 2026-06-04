import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { requireTenantContext } from "@/presentation/auth/session";
import { z } from "zod";


const dailySaleSchema = z.object({
  saleDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  cashAccountId: z.string().min(1),
  description:  z.string().optional(),
  items: z.array(z.object({
    revenueAccountId: z.string().min(1),
    description:      z.string().optional(),
    amount:           z.number().int().positive(),
    contacts: z.array(z.object({
      contactId: z.string().min(1),
      amount:    z.number().int().optional(),
      notes:     z.string().optional(),
    })).optional().default([]),
  })).min(1),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const { businessId, actorUserId } = await requireTenantContext(request);
    const body = dailySaleSchema.parse(await request.json());

    const totalAmount = BigInt(body.items.reduce((s, it) => s + it.amount, 0));
    const txDate = new Date(body.saleDate);

    // Cari atau buat fiscal period
    const year = txDate.getFullYear();
    let period = await prisma.fiscalPeriod.findFirst({
      where: { businessId, fiscalYear: year },
    });
    if (!period) {
      period = await prisma.fiscalPeriod.create({
        data: {
          businessId,
          name: `Tahun Buku ${year}`,
          fiscalYear: year,
          startsOn: new Date(Date.UTC(year, 0, 1)),
          endsOn:   new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
          status:   "OPEN",
        },
      });
    }

    // Generate journal number
    const last = await prisma.journalEntry.findFirst({
      where: { businessId },
      orderBy: { journalNumber: "desc" },
      select: { journalNumber: true },
    });
    const nextNum = last
      ? parseInt(last.journalNumber.replace(/\D/g, "")) + 1
      : 1;
    const journalNumber = `JU${String(nextNum).padStart(5, "0")}`;

    // Buat DailySale + JournalEntry dalam satu transaksi
    const result = await prisma.$transaction(async (tx) => {
      // Buat jurnal
      const journal = await tx.journalEntry.create({
        data: {
          businessId,
          fiscalPeriodId: period!.id,
          journalNumber,
          transactionDate: txDate,
          source:          "DAILY_SALE",
          description:     body.description ?? `Penjualan ${body.saleDate}`,
          totalDebit:      totalAmount,
          totalCredit:     totalAmount,
          postedByUserId:  actorUserId,
          lines: {
            create: [
              // DEBIT: kas
              {
                businessId,
                accountId: body.cashAccountId,
                side:      "DEBIT",
                amount:    totalAmount,
                lineNo:    1,
              },
              // CREDIT: satu baris per revenue item
              ...body.items.map((it, idx) => ({
                businessId,
                accountId: it.revenueAccountId,
                side:      "CREDIT" as const,
                amount:    BigInt(it.amount),
                memo:      it.description ?? null,
                lineNo:    idx + 2,
              })),
            ],
          },
        },
      });

      // Buat DailySale
      const sale = await tx.dailySale.create({
        data: {
          businessId,
          saleDate:       txDate,
          cashAccountId:  body.cashAccountId,
          description:    body.description ?? null,
          totalAmount,
          journalId:      journal.id,
          createdByUserId: actorUserId,
          items: {
            create: (body.items.map((it, idx) => ({
              revenueAccountId: it.revenueAccountId,
              description:      it.description ?? null,
              amount:           BigInt(it.amount),
              lineNo:           idx + 1,
              contacts: it.contacts.length
                ? {
                    create: it.contacts.map((c) => ({
                      contactId: c.contactId,
                      amount:    c.amount != null ? BigInt(c.amount) : null,
                      notes:     c.notes ?? null,
                    })),
                  }
                : undefined,
            })) as any),
          },
        },
        include: { items: { include: { contacts: true } } },
      });

      // Update loyalty counters untuk setiap kontak
      for (const it of body.items) {
        for (const c of it.contacts) {
          await tx.contact.update({
            where: { id: c.contactId },
            data: {
              totalVisits:  { increment: 1 },
              totalRevenue: { increment: BigInt(c.amount ?? it.amount) },
            },
          });
        }
      }

      return { sale, journalNumber };
    });

    return result;
  });
}
