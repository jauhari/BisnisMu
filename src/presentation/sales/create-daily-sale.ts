import { Prisma } from "@prisma/client";
import { prisma, prismaDirect } from "@/presentation/api/prisma";
import { nextJournalNumber } from "@/presentation/accounting/journal-workflows";

export interface DailySaleItemInput {
  revenueAccountId: string;
  description?: string | undefined;
  amount: number;
  contacts?: Array<{
    contactId: string;
    amount?: number | undefined;
    notes?: string | undefined;
  }> | undefined;
}

export interface CreateDailySaleInput {
  businessId: string;
  actorUserId: string;
  saleDate: string;
  cashAccountId: string;
  description?: string | undefined;
  items: DailySaleItemInput[];
}

export async function createDailySale(input: CreateDailySaleInput) {
  const totalAmount = BigInt(input.items.reduce((s, it) => s + it.amount, 0));
  const txDate = new Date(input.saleDate);

  const year = txDate.getFullYear();
  let period = await prisma.fiscalPeriod.findFirst({
    where: { businessId: input.businessId, fiscalYear: year },
  });
  if (!period) {
    period = await prisma.fiscalPeriod.create({
      data: {
        businessId: input.businessId,
        name: `Tahun Buku ${year}`,
        fiscalYear: year,
        startsOn: new Date(Date.UTC(year, 0, 1)),
        endsOn: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
        status: "OPEN",
      },
    });
  }

  let result:
    | { sale: Awaited<ReturnType<typeof prisma.dailySale.create>>; journalNumber: string }
    | undefined;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      result = await prismaDirect.$transaction(async (tx) => {
        const journalNumber = await nextJournalNumber(tx, input.businessId, txDate);

        const journal = await tx.journalEntry.create({
          data: {
            businessId: input.businessId,
            fiscalPeriodId: period!.id,
            journalNumber,
            transactionDate: txDate,
            source: "DAILY_SALE",
            description: input.description ?? `Penjualan ${input.saleDate}`,
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            postedByUserId: input.actorUserId,
            lines: {
              create: [
                {
                  businessId: input.businessId,
                  accountId: input.cashAccountId,
                  side: "DEBIT",
                  amount: totalAmount,
                  lineNo: 1,
                },
                ...input.items.map((it, idx) => ({
                  businessId: input.businessId,
                  accountId: it.revenueAccountId,
                  side: "CREDIT" as const,
                  amount: BigInt(it.amount),
                  memo: it.description ?? null,
                  lineNo: idx + 2,
                })),
              ],
            },
          },
        });

        const sale = await tx.dailySale.create({
          data: {
            businessId: input.businessId,
            saleDate: txDate,
            cashAccountId: input.cashAccountId,
            description: input.description ?? null,
            totalAmount,
            journalId: journal.id,
            createdByUserId: input.actorUserId,
            items: {
              create: input.items.map((it, idx) => ({
                revenueAccountId: it.revenueAccountId,
                description: it.description ?? null,
                amount: BigInt(it.amount),
                lineNo: idx + 1,
                contacts: it.contacts?.length
                  ? {
                      create: it.contacts.map((c) => ({
                        contactId: c.contactId,
                        amount: c.amount != null ? BigInt(c.amount) : null,
                        notes: c.notes ?? null,
                      })),
                    }
                  : undefined,
              })) as any,
            },
          },
          include: { items: { include: { contacts: true } } },
        });

        const contactAggregates = new Map<string, { visits: number; revenue: bigint }>();
        for (const it of input.items) {
          for (const c of it.contacts ?? []) {
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
              totalVisits: { increment: agg.visits },
              totalRevenue: { increment: agg.revenue },
            },
          });
        }

        return { sale, journalNumber };
      }, { maxWait: 10_000, timeout: 20_000 });
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
}