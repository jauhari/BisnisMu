import { Prisma } from "@prisma/client";
import { handleApi } from "@/presentation/api/route-handler";
import { prisma } from "@/presentation/api/prisma";
import { requireTenantContext } from "@/presentation/auth/session";
import { nextJournalNumber } from "@/presentation/accounting/journal-workflows";
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

    // Buat DailySale + JournalEntry dalam satu transaksi (nomor jurnal di-generate
    // di dalam transaksi dengan advisory lock — sama seperti alur jurnal lainnya)
    let result: { sale: Awaited<ReturnType<typeof prisma.dailySale.create>>; journalNumber: string } | undefined;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const journalNumber = await nextJournalNumber(tx, businessId, txDate);

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
                  {
                    businessId,
                    accountId: body.cashAccountId,
                    side:      "DEBIT",
                    amount:    totalAmount,
                    lineNo:    1,
                  },
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

          const contactAggregates = new Map<string, { visits: number; revenue: bigint }>();
          for (const it of body.items) {
            for (const c of it.contacts) {
              const prev = contactAggregates.get(c.contactId) ?? { visits: 0, revenue: 0n };
              prev.visits += 1;
              prev.revenue += BigInt(c.amount ?? it.amount);
              contactAggregates.set(c.contactId, prev);
            }
          }
          for (const [contactId, agg] of contactAggregates) {
            await tx.contact.update({
              where: { id: contactId },
              data: {
                totalVisits:  { increment: agg.visits },
                totalRevenue: { increment: agg.revenue },
              },
            });
          }

          return { sale, journalNumber };
        }, {
          // Neon (remote, via PgBouncer) menambah latency per query. Default Prisma
          // 5000ms terlalu ketat untuk transaksi multi-write ini.
          maxWait: 10_000,
          timeout: 20_000,
        });
        break;
      } catch (error) {
        const isRetryable =
          (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
          (error instanceof Error && error.message.includes("could not serialize")) ||
          (error instanceof Error && error.message.includes("deadlock"));
        if (isRetryable && attempt < 9) {
          await new Promise((r) => setTimeout(r, Math.random() * 50 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }

    if (!result) throw new Error("Gagal membuat jurnal penjualan harian.");
    return result;
  });
}
