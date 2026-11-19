#!/usr/bin/env node
/**
 * Perbaikan data business "Pelatihan Bendahara Angkatan 7" agar persis sama
 * dengan workbook final peserta: NURUDIN JAUHARI - LKP1_Bendahara_KDKMP.xlsx.
 *
 * Beda dengan impor pertama (Google Sheets draf):
 *   - 40 entri (bukan 41): entri PPh badan BM-007 tidak ada di jawaban peserta
 *   - BKM-013 penjualan LPG Rp 1.350.000 (sebelumnya 2.550.000)
 *   - BKM-016 bunga tabungan Rp 125.000 (sebelumnya 100.000)
 *
 * Sifat: mengganti jurnal + ledger simpanan anggota untuk business tersebut saja.
 * Business lain tidak disentuh.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const BUSINESS_NAME = "Pelatihan Bendahara Angkatan 7";
const SRC = "/tmp/kdkmp/journal.json";

const prisma = new PrismaClient();
const journal = JSON.parse(readFileSync(SRC, "utf8"));

// ── Pemetaan kode workbook → kode 6 digit (sama seperti impor pertama) ───────
const GROUP_BY_DIGIT = { 1: "ASSET", 2: "LIABILITY", 3: "EQUITY", 4: "REVENUE", 5: "COGS", 6: "EXPENSE", 7: "OTHER_EXPENSE" };

function mapAccount(legacy) {
  const group = legacy[0];
  const n = legacy.slice(2);
  if (group === "5") {
    if (legacy === "5-1110") return { code: "511100", parentCode: "510000" };
    if (n[0] === "1") return { code: `6${n}0`, parentCode: "610000" };
    return { code: `7${n}0`, parentCode: "710000" };
  }
  return { code: `${group}${n}0`, parentCode: null };
}

const business = await prisma.business.findFirst({ where: { name: BUSINESS_NAME } });
if (!business) throw new Error(`Business "${BUSINESS_NAME}" tidak ditemukan`);

const actor = await prisma.user.findFirstOrThrow({ where: { email: "barookahjaya@gmail.com" } });
const businessId = business.id;

const period = await prisma.fiscalPeriod.findFirstOrThrow({ where: { businessId, fiscalYear: 2025 } });

const accounts = await prisma.account.findMany({ where: { businessId }, select: { id: true, code: true } });
const accountByCode = new Map(accounts.map((a) => [a.code, a.id]));

const legacyToCode = new Map();
for (const entry of journal) {
  for (const line of entry.lines) legacyToCode.set(line.account, mapAccount(line.account).code);
}
const missing = [...legacyToCode.entries()].filter(([, code]) => !accountByCode.has(code));
if (missing.length) {
  throw new Error(`Akun belum ada di CoA: ${missing.map(([legacy, code]) => `${legacy}→${code}`).join(", ")}`);
}

// ── 1. Bersihkan jurnal + ledger simpanan lama ───────────────────────────────
const delLines = await prisma.journalLine.deleteMany({ where: { businessId } });
const delEntries = await prisma.journalEntry.deleteMany({ where: { businessId } });
const delSavings = await prisma.memberSaving.deleteMany({ where: { businessId } });
console.log(`✓ Bersihkan: ${delEntries.count} jurnal (${delLines.count} baris), ${delSavings.count} baris simpanan`);

// ── 2. Impor jurnal jawaban peserta ──────────────────────────────────────────
let seq = 0;
let written = 0;

for (const entry of journal) {
  seq += 1;
  const lines = [];

  for (const line of entry.lines) {
    const accountId = accountByCode.get(legacyToCode.get(line.account));
    const memberMemo = line.member ? `[Anggota ${line.member}${line.memberName ? " " + line.memberName : ""}]` : null;
    if (line.debit > 0) lines.push({ accountId, side: "DEBIT", amount: BigInt(line.debit), memo: memberMemo });
    if (line.credit > 0) lines.push({ accountId, side: "CREDIT", amount: BigInt(line.credit), memo: memberMemo });
  }

  const totalDebit = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0n);
  const totalCredit = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0n);
  if (totalDebit !== totalCredit) throw new Error(`Entri tidak seimbang: ${entry.date} ${entry.noBukti}`);

  await prisma.journalEntry.create({
    data: {
      businessId,
      fiscalPeriodId: period.id,
      journalNumber: `JV-202512-${String(seq).padStart(5, "0")}`,
      transactionDate: new Date(`${entry.date}T00:00:00Z`),
      source: "IMPORT_KDKMP",
      sourceId: `${entry.date}|${entry.noBukti}`,
      description: `${entry.noBukti} — ${entry.description}`.slice(0, 500),
      status: "POSTED",
      totalDebit,
      totalCredit,
      postedByUserId: actor.id,
      idempotencyKey: `import:kdkmp:${entry.date}:${entry.noBukti}`,
      lines: { create: lines.map((l, i) => ({ businessId, accountId: l.accountId, side: l.side, amount: l.amount, memo: l.memo, lineNo: i + 1 })) },
    },
  });
  written += 1;
}
console.log(`✓ ${written} jurnal jawaban peserta diimpor`);

// ── 3. Bangun ulang ledger simpanan anggota dari memo jurnal ─────────────────
const savingAccounts = new Map([["311000", "POKOK"], ["312000", "WAJIB"]]);
const savingAccountIds = [...savingAccounts.keys()].map((code) => accountByCode.get(code));
const memberRows = await prisma.member.findMany({ where: { businessId }, select: { id: true, memberNumber: true } });
const memberByNumber = new Map(memberRows.map((m) => [m.memberNumber, m.id]));

const lines = await prisma.journalLine.findMany({
  where: { businessId, accountId: { in: savingAccountIds } },
  include: { journal: { select: { transactionDate: true } } },
});

let savings = 0;
for (const line of lines) {
  const match = /Anggota\s+(\d+)/i.exec(line.memo ?? "");
  if (!match) continue;
  const memberId = memberByNumber.get(match[1]);
  const accountCode = [...savingAccounts.keys()].find((code) => accountByCode.get(code) === line.accountId);
  if (!memberId || !accountCode) continue;
  await prisma.memberSaving.create({
    data: {
      businessId,
      memberId,
      type: savingAccounts.get(accountCode),
      direction: line.side === "CREDIT" ? "DEPOSIT" : "WITHDRAWAL",
      accountId: line.accountId,
      transactionDate: line.journal.transactionDate,
      amount: line.amount,
      journalId: line.journalId,
      note: line.memo,
      createdByUserId: actor.id,
    },
  });
  savings += 1;
}
console.log(`✓ ${savings} baris simpanan anggota dibangun ulang`);

// ── 4. Verifikasi ────────────────────────────────────────────────────────────
const agg = await prisma.journalLine.groupBy({ by: ["side"], where: { businessId }, _sum: { amount: true } });
const debit = agg.find((a) => a.side === "DEBIT")?._sum.amount ?? 0n;
const credit = agg.find((a) => a.side === "CREDIT")?._sum.amount ?? 0n;

const rows = await prisma.journalLine.findMany({
  where: { businessId },
  include: { account: { select: { code: true, name: true, groupCode: true, normalBalance: true } } },
});
const balance = new Map();
for (const line of rows) {
  const key = line.accountId;
  const current = balance.get(key) ?? { code: line.account.code, name: line.account.name, group: line.account.groupCode, normal: line.account.normalBalance, net: 0n };
  current.net += line.side === "DEBIT" ? line.amount : -line.amount;
  balance.set(key, current);
}
const net = (account) => {
  const row = [...balance.values()].find((b) => b.code === account);
  if (!row) return 0n;
  return row.normal === "DEBIT" ? row.net : -row.net;
};
const sumGroup = (group) => [...balance.values()].filter((b) => b.group === group).reduce((s, b) => s + (b.normal === "DEBIT" ? b.net : -b.net), 0n);

const pendapatan = sumGroup("REVENUE");
const hpp = sumGroup("COGS");
const beban = sumGroup("EXPENSE");
const bebanLain = sumGroup("OTHER_EXPENSE");
const shu = pendapatan - hpp - beban - bebanLain;

console.log("\n── VERIFIKASI ─────────────────────────────");
console.log(`Jurnal        : ${await prisma.journalEntry.count({ where: { businessId } })} entri`);
console.log(`Debit         : Rp ${debit.toLocaleString("id-ID")}`);
console.log(`Kredit        : Rp ${credit.toLocaleString("id-ID")}`);
console.log(`Selisih       : Rp ${(debit - credit).toLocaleString("id-ID")}`);
console.log(`Penjualan     : Rp ${net("411000").toLocaleString("id-ID")}   (workbook: 59.455.000)`);
console.log(`HPP           : Rp ${hpp.toLocaleString("id-ID")}   (workbook: 45.500.000)`);
console.log(`Kas           : Rp ${net("111100").toLocaleString("id-ID")}   (workbook: 17.325.000)`);
console.log(`Bank          : Rp ${net("111200").toLocaleString("id-ID")}   (workbook: 26.075.000)`);
console.log(`Persediaan    : Rp ${net("112200").toLocaleString("id-ID")}   (workbook: 7.000.000)`);
console.log(`SHU           : Rp ${shu.toLocaleString("id-ID")}   (workbook: 29.541.667)`);

await prisma.$disconnect();
