#!/usr/bin/env node

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });

const BUSINESS_ID = "pku_dc97ee4b3d8e4054b7cd595fe515db12";
const OWNER_EMAIL = "barookahjaya@gmail.com";
const APPLY = process.argv.includes("--apply");
const rawDatabaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!rawDatabaseUrl) throw new Error("DATABASE_URL or DIRECT_URL is required");

const prisma = new PrismaClient({
  datasources: { db: { url: rawDatabaseUrl.replace("-pooler.", ".") } },
});

const json = (value) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, null, 2);

function isCashAccount(account) {
  const subtype = String(account.subtype ?? "").trim().toLowerCase();
  return account.groupCode === "ASSET" && (subtype === "cash" || subtype === "bank" || account.code.startsWith("111") || account.code.startsWith("112"));
}

function contactPlan(description) {
  const text = description.toLowerCase();
  if (text.includes("internet") || text.includes("telpon")) return { name: "Telkom", type: "SUPPLIER", category: "INSTANSI" };
  if (text.includes("listrik")) return { name: "PLN", type: "SUPPLIER", category: "INSTANSI" };
  if (text.includes("transfer dari pku") || text.includes("klaim mucare")) return { name: "PKU Wonosari", type: "SUPPLIER", category: "INSTANSI" };
  if (text.includes("gaji dokter") || text.includes("choirotun")) return { name: "Choirotun Jum’iyyatun Nisak", type: "OTHER", category: "INDIVIDUAL" };
  if (text.includes("gaji perawat") || text.includes("laras")) return { name: "Laras Nugraheny", type: "OTHER", category: "INDIVIDUAL" };
  if (text.includes("gaji fisioterapi")) return { name: "Fisioterapi", type: "OTHER", category: "INDIVIDUAL" };
  if (text.includes("gaji kebersihan") || text.includes("dedi")) return { name: "Dedi", type: "OTHER", category: "INDIVIDUAL" };
  return null;
}

function classifyJournal(journal, accountById, cashAccountIds) {
  const cashLines = journal.lines.filter((line) => cashAccountIds.has(line.accountId));
  const otherLines = journal.lines.filter((line) => !cashAccountIds.has(line.accountId));
  if (cashLines.length === 2 && otherLines.length === 0) {
    const source = cashLines.find((line) => line.side === "CREDIT");
    const destination = cashLines.find((line) => line.side === "DEBIT");
    if (!source || !destination || source.accountId === destination.accountId) throw new Error(`Invalid transfer journal ${journal.journalNumber}`);
    return {
      type: "TRANSFER",
      amount: source.amount,
      cashAccountId: source.accountId,
      destinationAccountId: destination.accountId,
      categoryAccountId: null,
      contact: null,
    };
  }

  if (cashLines.length !== 1 || otherLines.length !== 1) throw new Error(`Expected one cash line and one category line for ${journal.journalNumber}`);
  const cashLine = cashLines[0];
  const categoryLine = otherLines[0];
  const type = cashLine.side === "DEBIT" ? "CASH_IN" : "CASH_OUT";
  const account = accountById.get(categoryLine.accountId);
  return {
    type,
    amount: cashLine.amount,
    cashAccountId: cashLine.accountId,
    destinationAccountId: null,
    categoryAccountId: categoryLine.accountId,
    contact: contactPlan(journal.description),
    category: account ? `${account.code} ${account.name}` : categoryLine.accountId,
  };
}

async function getOrCreateContact(tx, plan, businessId) {
  if (!plan) return null;
  const existing = await tx.contact.findFirst({ where: { businessId, name: plan.name } });
  if (existing) return existing;
  return tx.contact.create({
    data: {
      businessId,
      name: plan.name,
      type: plan.type,
      category: plan.category,
      isActive: true,
    },
  });
}

async function main() {
  const [business, owner, accounts, journals, existingTransactions] = await Promise.all([
    prisma.business.findUnique({ where: { id: BUSINESS_ID }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } }),
    prisma.account.findMany({ where: { businessId: BUSINESS_ID }, select: { id: true, code: true, name: true, subtype: true, groupCode: true } }),
    prisma.journalEntry.findMany({
      where: { businessId: BUSINESS_ID, status: "POSTED", source: "LEGACY_EXACT_VS" },
      select: { id: true, journalNumber: true, transactionDate: true, description: true, postedAt: true, lines: { select: { accountId: true, side: true, amount: true }, orderBy: { lineNo: "asc" } } },
      orderBy: { transactionDate: "asc" },
    }),
    prisma.cashTransaction.findMany({ where: { businessId: BUSINESS_ID }, select: { postedJournalId: true } }),
  ]);

  if (!business) throw new Error(`Business not found: ${BUSINESS_ID}`);
  if (!owner) throw new Error(`Owner not found: ${OWNER_EMAIL}`);

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const cashAccountIds = new Set(accounts.filter(isCashAccount).map((account) => account.id));
  const existingJournalIds = new Set(existingTransactions.map((transaction) => transaction.postedJournalId).filter(Boolean));
  const pending = journals.filter((journal) => !existingJournalIds.has(journal.id)).map((journal, index) => ({ journal, mapped: classifyJournal(journal, accountById, cashAccountIds), index }));
  const contactPlans = [...new Map(pending.map(({ mapped }) => mapped.contact).filter(Boolean).map((contact) => [contact.name, contact])).values()];

  const preview = {
    business: business.name,
    legacyJournals: journals.length,
    alreadyLinked: journals.length - pending.length,
    toImport: pending.length,
    contactsToUseOrCreate: contactPlans.map((contact) => contact.name),
    byType: pending.reduce((counts, item) => ({ ...counts, [item.mapped.type]: (counts[item.mapped.type] ?? 0) + 1 }), {}),
    byContact: pending.reduce((counts, item) => {
      const name = item.mapped.contact?.name ?? "Tanpa kontak";
      return { ...counts, [name]: (counts[name] ?? 0) + 1 };
    }, {}),
    sample: pending.slice(0, 8).map(({ journal, mapped }) => ({
      journal: journal.journalNumber,
      date: journal.transactionDate.toISOString().slice(0, 10),
      description: journal.description,
      type: mapped.type,
      amount: mapped.amount,
      contact: mapped.contact?.name ?? null,
    })),
  };
  console.log(json(preview));
  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to create posted cash transaction rows without creating duplicate journals.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const contacts = new Map();
    for (const plan of contactPlans) contacts.set(plan.name, await getOrCreateContact(tx, plan, BUSINESS_ID));
    const rows = [];
    const monthSequences = new Map();
    for (const { journal, mapped } of pending) {
      const month = `${journal.transactionDate.getUTCFullYear()}${String(journal.transactionDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const current = monthSequences.get(month) ?? 0;
      const sequence = current + 1;
      monthSequences.set(month, sequence);
      rows.push({
        businessId: BUSINESS_ID,
        transactionNumber: `CASH-${month}-IMP-${String(sequence).padStart(4, "0")}`,
        type: mapped.type,
        status: "POSTED",
        transactionDate: journal.transactionDate,
        cashAccountId: mapped.cashAccountId,
        destinationAccountId: mapped.destinationAccountId,
        categoryAccountId: mapped.categoryAccountId,
        contactId: mapped.contact ? contacts.get(mapped.contact.name)?.id ?? null : null,
        amount: mapped.amount,
        description: journal.description,
        paymentMethod: null,
        referenceNumber: journal.journalNumber,
        attachmentKey: null,
        tags: ["legacy-import", "PKU24", "journal-linked"],
        postedJournalId: journal.id,
        voidJournalId: null,
        voidReason: null,
        createdByUserId: owner.id,
        postedByUserId: owner.id,
        voidedByUserId: null,
        postedAt: journal.postedAt ?? journal.transactionDate,
        voidedAt: null,
      });
    }
    if (rows.length) await tx.cashTransaction.createMany({ data: rows });
    return { imported: rows.length, contacts: contacts.size };
  }, { maxWait: 10_000, timeout: 30_000 });
  console.log(json({ applied: true, ...result }));
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
