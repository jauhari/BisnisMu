import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";
import { z } from "zod";

const schema = z.object({
  startsOn:  z.coerce.date().optional(),
  endsOn:    z.coerce.date().optional(),
  type:      z.enum(["kas", "piutang", "utang"]).default("kas"),
  accountId: z.string().optional(), // filter per akun spesifik (untuk kas)
  contactId: z.string().optional(), // filter per kontak (untuk piutang/utang)
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const { businessId } = await requireTenantContext(request);
    const body = schema.parse(await request.json());
    const { type, startsOn, endsOn, accountId, contactId } = body;

    // ── KAS: mutasi per akun kas/bank ─────────────────────────────────────────
    if (type === "kas") {
      // Ambil semua akun kas/bank milik bisnis ini
      const accounts = await prisma.account.findMany({
        where: { businessId, subtype: { in: ["cash", "bank"] }, isActive: true },
        orderBy: { code: "asc" },
      });

      const result = await Promise.all(
        accounts
          .filter((a) => !accountId || a.id === accountId)
          .map(async (acc) => {
            // Saldo awal (sebelum startsOn)
            const openingRows = startsOn
              ? await prisma.journalLine.groupBy({
                  by: ["side"],
                  where: { businessId, accountId: acc.id, journal: { transactionDate: { lt: startsOn } } },
                  _sum: { amount: true },
                })
              : [];
            const openingDebit  = openingRows.find((r) => r.side === "DEBIT")?._sum?.amount  ?? 0n;
            const openingCredit = openingRows.find((r) => r.side === "CREDIT")?._sum?.amount ?? 0n;
            const openingBalance = openingDebit - openingCredit;

            // Mutasi dalam periode
            const lines = await prisma.journalLine.findMany({
              where: {
                businessId,
                accountId: acc.id,
                ...(startsOn || endsOn ? {
                  journal: {
                    transactionDate: {
                      ...(startsOn ? { gte: startsOn } : {}),
                      ...(endsOn   ? { lte: endsOn   } : {}),
                    },
                  },
                } : {}),
              },
              include: {
                journal: { select: { journalNumber: true, transactionDate: true, description: true } },
              },
              orderBy: [{ journal: { transactionDate: "asc" } }, { lineNo: "asc" }],
            });

            // Hitung saldo berjalan
            let running = openingBalance;
            const rows = lines.map((l) => {
              const amt = BigInt(l.amount);
              running = l.side === "DEBIT" ? running + amt : running - amt;
              return {
                tanggal:   l.journal.transactionDate,
                nomor:     l.journal.journalNumber,
                keterangan: l.memo ?? l.journal.description ?? "",
                debit:     l.side === "DEBIT"  ? amt : 0n,
                kredit:    l.side === "CREDIT" ? amt : 0n,
                saldo:     running,
              };
            });

            return {
              accountId: acc.id,
              kodeAkun:  acc.code,
              namaAkun:  acc.name,
              subtype:   acc.subtype,
              saldoAwal: openingBalance,
              mutasi: rows,
              saldoAkhir: running,
            };
          })
      );

      return { type: "kas", accounts: result };
    }

    // ── PIUTANG: per pelanggan ────────────────────────────────────────────────
    if (type === "piutang") {
      const contacts = await prisma.contact.findMany({
        where: { businessId, ...(contactId ? { id: contactId } : {}) },
        orderBy: { name: "asc" },
      });

      // Cari akun piutang (subtype accounts_receivable)
      const arAccount = await prisma.account.findFirst({
        where: { businessId, subtype: "accounts_receivable", isActive: true },
      });

      const result = await Promise.all(contacts.map(async (c) => {
        // Cari invoice terkait kontak ini
        const invoices = await prisma.invoice.findMany({
          where: {
            businessId,
            ...(contactId ? { contactId } : {}),
            ...(startsOn || endsOn ? {
              issueDate: {
                ...(startsOn ? { gte: startsOn } : {}),
                ...(endsOn   ? { lte: endsOn   } : {}),
              },
            } : {}),
          },
          orderBy: { issueDate: "asc" },
        });

        const invoicesForContact = invoices.filter((inv) => (inv as any).contactId === c.id || (inv as any).customerId === c.id);

        const totalTagihan = invoicesForContact.reduce((s, inv) => s + BigInt((inv as any).totalAmount ?? 0), 0n);
        const totalLunas   = invoicesForContact.filter((inv) => (inv as any).status === "PAID").reduce((s, inv) => s + BigInt((inv as any).totalAmount ?? 0), 0n);
        const sisaPiutang  = totalTagihan - totalLunas;

        return {
          contactId:   c.id,
          nama:        c.name,
          kategori:    c.category,
          totalTagihan,
          totalLunas,
          sisaPiutang,
          invoices:    invoicesForContact.map((inv) => ({
            nomor:     (inv as any).invoiceNumber ?? inv.id,
            tanggal:   (inv as any).issueDate,
            jatuhTempo: (inv as any).dueDate,
            jumlah:    BigInt((inv as any).totalAmount ?? 0),
            status:    (inv as any).status ?? "DRAFT",
          })),
        };
      }));

      return { type: "piutang", arAccountId: arAccount?.id, contacts: result.filter((c) => c.totalTagihan > 0n || !contactId) };
    }

    // ── UTANG: per vendor/pemasok ─────────────────────────────────────────────
    if (type === "utang") {
      const contacts = await prisma.contact.findMany({
        where: { businessId, ...(contactId ? { id: contactId } : {}) },
        orderBy: { name: "asc" },
      });

      const bills = await prisma.bill.findMany({
        where: {
          businessId,
          ...(startsOn || endsOn ? {
            issueDate: {
              ...(startsOn ? { gte: startsOn } : {}),
              ...(endsOn   ? { lte: endsOn   } : {}),
            },
          } : {}),
        },
        orderBy: { issueDate: "asc" },
      });

      const result = contacts.map((c) => {
        const billsForContact = bills.filter((b) => (b as any).contactId === c.id || (b as any).vendorId === c.id);
        const totalTagihan = billsForContact.reduce((s, b) => s + BigInt((b as any).totalAmount ?? 0), 0n);
        const totalLunas   = billsForContact.filter((b) => (b as any).status === "PAID").reduce((s, b) => s + BigInt((b as any).totalAmount ?? 0), 0n);
        const sisaUtang    = totalTagihan - totalLunas;

        return {
          contactId: c.id,
          nama:      c.name,
          kategori:  c.category,
          totalTagihan,
          totalLunas,
          sisaUtang,
          bills: billsForContact.map((b) => ({
            nomor:     (b as any).billNumber ?? b.id,
            tanggal:   (b as any).issueDate,
            jatuhTempo: (b as any).dueDate,
            jumlah:    BigInt((b as any).totalAmount ?? 0),
            status:    (b as any).status ?? "DRAFT",
          })),
        };
      });

      return { type: "utang", contacts: result.filter((c) => c.totalTagihan > 0n || !contactId) };
    }

    throw new Error("Tipe tidak valid.");
  });
}
