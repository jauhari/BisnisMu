import { Prisma, type PrismaClient } from "@prisma/client";
import { AccountingEngine } from "@/features/accounting/domain/accounting-engine";
import type { TenantContext, JournalSide } from "@/features/accounting/domain/accounting-types";

const engine = new AccountingEngine();

type JournalLineBody = { accountId: string; side: JournalSide; amount: bigint };
export type JournalDraftBody = { transactionDate: Date; source: string; sourceId?: string | undefined; description: string; lines: JournalLineBody[] };

export async function validateManualJournal(prisma: PrismaClient, ctx: TenantContext, body: JournalDraftBody) {
  const accountIds = [...new Set(body.lines.map((line) => line.accountId))];
  const [accounts, fiscalPeriod] = await Promise.all([
    prisma.account.findMany({ where: { businessId: ctx.businessId, id: { in: accountIds } } }),
    prisma.fiscalPeriod.findFirst({ where: { businessId: ctx.businessId, startsOn: { lte: body.transactionDate }, endsOn: { gte: body.transactionDate }, isClosed: false }, orderBy: { startsOn: "desc" } }),
  ]);
  const groupMap = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;
  const snapshots = accounts.map((account) => ({
    id: account.id,
    businessId: account.businessId,
    code: account.code,
    name: account.name,
    groupCode: groupMap[account.groupCode],
    normalBalance: account.normalBalance,
    subtype: account.subtype,
    isPostingAllowed: account.isPostingAllowed,
    isActive: account.isActive,
  }));
  if (!fiscalPeriod) throw new Error("No open fiscal period exists for the transaction date.");
  const input = { businessId: ctx.businessId, transactionDate: body.transactionDate, source: body.source, description: body.description, lines: body.lines };
  if (body.sourceId !== undefined) Object.assign(input, { sourceId: body.sourceId });
  return engine.validateJournal(input, snapshots, fiscalPeriod);
}

export async function nextJournalNumber(tx: Prisma.TransactionClient, businessId: string, transactionDate: Date) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId + ":journal"}))`;
  const year = transactionDate.getUTCFullYear();
  const month = String(transactionDate.getUTCMonth() + 1).padStart(2, "0");
  const prefix = "JV-" + year + month + "-";
  const seqStart = prefix.length + 1;
  const rows = await tx.$queryRaw<Array<{ next_seq: number | bigint | null }>>`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(journal_number FROM ${seqStart}) AS INTEGER)
    ), 0) + 1 AS next_seq
    FROM journal_entries
    WHERE business_id = ${businessId}
      AND journal_number LIKE ${prefix + "%"}
  `;
  const nextSeq = Number(rows[0]?.next_seq ?? 1);
  return prefix + String(nextSeq).padStart(5, "0");
}

export async function createJournal(prisma: PrismaClient, ctx: TenantContext, body: JournalDraftBody, status: "DRAFT" | "POSTED") {
  const journal = await validateManualJournal(prisma, ctx, body);
  return prisma.$transaction(async (tx) => {
    const journalNumber = await nextJournalNumber(tx, ctx.businessId, journal.transactionDate);
    return tx.journalEntry.create({
      data: {
        businessId: ctx.businessId,
        fiscalPeriodId: journal.fiscalPeriod.id,
        journalNumber,
        transactionDate: journal.transactionDate,
        source: journal.source,
        sourceId: journal.sourceId ?? null,
        description: journal.description,
        status: status as any,
        totalDebit: journal.totalDebit,
        totalCredit: journal.totalCredit,
        postedByUserId: ctx.actorUserId,
        lines: { create: journal.lines.map((line, index) => ({ businessId: ctx.businessId, accountId: line.accountId, side: line.side, amount: line.amount, lineNo: index + 1 })) },
      },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
  }, { timeout: 30000 });
}

export async function updateDraftJournal(prisma: PrismaClient, ctx: TenantContext, journalId: string, body: JournalDraftBody) {
  const existing = await prisma.journalEntry.findFirst({ where: { id: journalId, businessId: ctx.businessId } });
  if (!existing) throw new Error("Journal not found.");
  if (String(existing.status) !== "DRAFT") throw new Error("Only draft journals can be edited.");
  const journal = await validateManualJournal(prisma, ctx, body);
  return prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany({ where: { businessId: ctx.businessId, journalId } });
    return tx.journalEntry.update({
      where: { id: journalId },
      data: {
        fiscalPeriodId: journal.fiscalPeriod.id,
        transactionDate: journal.transactionDate,
        source: journal.source,
        sourceId: journal.sourceId ?? null,
        description: journal.description,
        totalDebit: journal.totalDebit,
        totalCredit: journal.totalCredit,
        lines: { create: journal.lines.map((line, index) => ({ businessId: ctx.businessId, accountId: line.accountId, side: line.side, amount: line.amount, lineNo: index + 1 })) },
      },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
  });
}

export async function postDraftJournal(prisma: PrismaClient, ctx: TenantContext, journalId: string) {
  const existing = await prisma.journalEntry.findFirst({ where: { id: journalId, businessId: ctx.businessId } });
  if (!existing) throw new Error("Journal not found.");
  if (String(existing.status) !== "DRAFT") throw new Error("Only draft journals can be posted.");
  return prisma.journalEntry.update({ where: { id: journalId }, data: { status: "POSTED", postedAt: new Date(), postedByUserId: ctx.actorUserId } });
}

export async function deleteDraftJournal(prisma: PrismaClient, ctx: TenantContext, journalId: string) {
  const existing = await prisma.journalEntry.findFirst({ where: { id: journalId, businessId: ctx.businessId } });
  if (!existing) throw new Error("Journal not found.");
  if (String(existing.status) !== "DRAFT") throw new Error("Only draft journals can be deleted.");
  await prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany({ where: { businessId: ctx.businessId, journalId } });
    await tx.journalEntry.delete({ where: { id: journalId } });
  });
  return { deleted: true };
}

export async function reversePostedJournal(prisma: PrismaClient, ctx: TenantContext, journalId: string) {
  const existing = await prisma.journalEntry.findFirst({ where: { id: journalId, businessId: ctx.businessId }, include: { lines: { orderBy: { lineNo: "asc" } } } });
  if (!existing) throw new Error("Journal not found.");
  if (existing.status !== "POSTED") throw new Error("Only posted journals can be reversed.");
  if (existing.reversedById) throw new Error("Journal already reversed.");
  const body: JournalDraftBody = {
    transactionDate: new Date(),
    source: "REVERSAL",
    sourceId: existing.id,
    description: "Reversal: " + existing.description,
    lines: existing.lines.map((line) => ({ accountId: line.accountId, side: line.side === "DEBIT" ? "CREDIT" : "DEBIT", amount: line.amount })),
  };
  const reversal = await createJournal(prisma, ctx, body, "POSTED");
  await prisma.journalEntry.update({ where: { id: existing.id }, data: { status: "REVERSED", reversedById: reversal.id } });
  return reversal;
}