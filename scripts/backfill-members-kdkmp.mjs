#!/usr/bin/env node
/**
 * Backfill anggota + simpanan untuk business "Pelatihan Bendahara Angkatan 7".
 *
 * Sumber: tab Anggota (master) dan baris jurnal yang sudah bertanda anggota
 * di memo ("[Anggota 1001 Aulia]"). Tidak membuat jurnal baru — hanya
 * merekam keanggotaan & ledger simpanan di atas jurnal yang sudah ada.
 *
 * Sifat: additive + idempotent (upsert berdasarkan nomor anggota).
 */
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";

// xlsx ESM build tidak punya readFile; pakai build CJS.
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const BUSINESS_NAME = "Pelatihan Bendahara Angkatan 7";
const WORKBOOK = "/private/var/folders/rh/d335m4zs4qs4bjgym_myxtcr0000gn/T/opencode/sheets/wb.xlsx";
const SAVING_ACCOUNTS = { "311000": "POKOK", "312000": "WAJIB" };

const prisma = new PrismaClient();

const business = await prisma.business.findFirst({ where: { name: BUSINESS_NAME } });
if (!business) throw new Error(`Business "${BUSINESS_NAME}" tidak ditemukan`);

const actor = await prisma.user.findFirst({ where: { email: "barookahjaya@gmail.com" } });
if (!actor) throw new Error("User aktor tidak ditemukan");

// ── 1. Master anggota dari workbook ─────────────────────────────────────────
const wb = XLSX.readFile(WORKBOOK, { cellFormula: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Anggota"], { header: 1, raw: false, defval: "" });

const members = [];
for (const row of rows.slice(4)) {
  const memberNumber = String(row[1] ?? "").trim();
  const name = String(row[2] ?? "").trim();
  if (!memberNumber || !name) continue;
  if (!/^\d+$/.test(memberNumber)) continue;
  // Workbook menyiapkan baris placeholder "anggota 13".."anggota 33" yang belum dipakai.
  if (/^anggota\s+\d+$/i.test(name)) continue;
  const entry = { memberNumber, name };
  const address = String(row[3] ?? "").trim();
  const phone = String(row[4] ?? "").trim();
  if (address) entry.address = address;
  if (phone) entry.phone = phone;
  members.push(entry);
}
console.log(`→ ${members.length} anggota dari workbook`);

for (const m of members) {
  await prisma.member.upsert({
    where: { businessId_memberNumber: { businessId: business.id, memberNumber: m.memberNumber } },
    create: {
      businessId: business.id,
      memberNumber: m.memberNumber,
      name: m.name,
      address: m.address ?? null,
      phone: m.phone ?? null,
      status: "ACTIVE",
    },
    update: { name: m.name, address: m.address ?? null, phone: m.phone ?? null },
  });
}
console.log("✓ master anggota tersimpan");

// ── 2. Backfill simpanan dari jurnal ───────────────────────────────────────
const accounts = await prisma.account.findMany({
  where: { businessId: business.id, code: { in: Object.keys(SAVING_ACCOUNTS) } },
  select: { id: true, code: true },
});
const accountByCode = new Map(accounts.map((a) => [a.code, a.id]));

const lines = await prisma.journalLine.findMany({
  where: { businessId: business.id, accountId: { in: accounts.map((a) => a.id) } },
  include: { journal: { select: { id: true, transactionDate: true, source: true } } },
  orderBy: { createdAt: "asc" },
});

const memberByNumber = new Map(
  (await prisma.member.findMany({ where: { businessId: business.id }, select: { id: true, memberNumber: true } })).map(
    (m) => [m.memberNumber, m.id],
  ),
);

let created = 0;
let skipped = 0;

for (const line of lines) {
  const match = /Anggota\s+(\d+)/i.exec(line.memo ?? "");
  if (!match) {
    skipped += 1;
    continue;
  }
  const memberId = memberByNumber.get(match[1]);
  const account = accounts.find((a) => a.id === line.accountId);
  if (!memberId || !account) {
    skipped += 1;
    continue;
  }

  const type = SAVING_ACCOUNTS[account.code];
  const existing = await prisma.memberSaving.findFirst({
    where: { businessId: business.id, memberId, journalId: line.journalId, type, amount: line.amount },
    select: { id: true },
  });
  if (existing) {
    skipped += 1;
    continue;
  }

  await prisma.memberSaving.create({
    data: {
      businessId: business.id,
      memberId,
      type,
      // Simpanan adalah akun ekuitas (saldo normal kredit): kredit = setoran.
      direction: line.side === "CREDIT" ? "DEPOSIT" : "WITHDRAWAL",
      accountId: account.id,
      transactionDate: line.journal.transactionDate,
      amount: line.amount,
      journalId: line.journalId,
      note: line.memo ?? null,
      createdByUserId: actor.id,
    },
  });
  created += 1;
}

console.log(`✓ ${created} baris simpanan dibuat, ${skipped} dilewati`);

// ── 3. Verifikasi ──────────────────────────────────────────────────────────
const balances = await prisma.memberSaving.groupBy({
  by: ["type", "direction"],
  where: { businessId: business.id },
  _sum: { amount: true },
});
console.log("\n── SALDO SIMPANAN ──");
for (const row of balances) {
  console.log(`${row.type.padEnd(9)} ${row.direction.padEnd(10)} Rp ${(row._sum.amount ?? 0n).toLocaleString("id-ID")}`);
}

const totalPokok = balances.filter((b) => b.type === "POKOK").reduce((s, b) => s + (b._sum.amount ?? 0n), 0n);
const totalWajib = balances.filter((b) => b.type === "WAJIB").reduce((s, b) => s + (b._sum.amount ?? 0n), 0n);
console.log(`\nTotal anggota : ${await prisma.member.count({ where: { businessId: business.id } })}`);
console.log(`Total Pokok   : Rp ${totalPokok.toLocaleString("id-ID")}`);
console.log(`Total Wajib   : Rp ${totalWajib.toLocaleString("id-ID")}`);

await prisma.$disconnect();
