#!/usr/bin/env node
/**
 * Import bisnis pelatihan KDKMP dari workbook Google Sheets.
 *
 * Sumber: coa.json + journal.json (hasil ekstraksi workbook "LKP KDKMP").
 * Tujuan: business baru "Pelatihan Bendahara Angkatan 7" — COA 66 akun + 41 jurnal.
 *
 * Sifat: additive. Hanya membuat data baru untuk satu businessId baru.
 * Re-run aman: kalau business sudah ada, script berhenti (pakai FORCE=1 untuk
 * membuat ulang data jurnal/akun business tersebut).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const DIR = "/private/var/folders/rh/d335m4zs4qs4bjgym_myxtcr0000gn/T/opencode/sheets";
const BUSINESS_NAME = "Pelatihan Bendahara Angkatan 7";
const ACTOR_EMAIL = "barookahjaya@gmail.com";
const FORCE = process.env.FORCE === "1";

const prisma = new PrismaClient();

const coa = JSON.parse(readFileSync(`${DIR}/coa.json`, "utf8"));
const journal = JSON.parse(readFileSync(`${DIR}/journal.json`, "utf8"));

// ── Mapping COA lama (1-1110) → 6 digit SAK EMKM ────────────────────────────
// Aturan: <group><4 digit><0>. Khusus group 5 dipisah menurut sifatnya:
// HPP → 5xxxxx (COGS), beban usaha → 6xxxxx (EXPENSE), beban lain → 7xxxxx.
const SUBTYPES = {
  "1-1110": "cash",
  "1-1120": "bank",
  "1-1130": "investment",
  "1-1210": "accounts_receivable",
  "1-1220": "inventory",
  "1-1230": "receivable",
  "1-1310": "prepaid_expense",
  "1-1320": "accrued_revenue",
  "1-1330": "supplies",
  "1-1340": "investment",
  "1-1350": "deferred_tax_asset",
  "1-1410": "investment",
  "1-1420": "investment",
  "1-1510": "fixed_asset",
  "1-1520": "contra_asset",
  "1-1530": "intangible_asset",
  "1-1540": "contra_asset",
  "1-1610": "other_asset",
  "2-1110": "tax_payable",
  "2-1120": "accounts_payable",
  "2-1140": "accrued_expense",
  "2-1150": "prepaid_income",
  "2-1190": "equity_distribution",
  "3-1100": "equity",
  "3-1200": "equity",
  "3-1400": "equity",
  "3-1500": "equity",
  "3-2100": "equity",
  "3-2200": "equity",
  "3-2300": "equity",
  "4-1100": "sales_revenue",
  "4-1200": "service_revenue",
  "4-1300": "other_revenue",
  "4-1400": "other_revenue",
  "4-1500": "service_revenue",
  "4-1600": "other_revenue",
  "4-1700": "other_revenue",
  "4-1800": "other_revenue",
  "5-1110": "cogs",
};

const GROUP_BY_DIGIT = {
  1: "ASSET",
  2: "LIABILITY",
  3: "EQUITY",
  4: "REVENUE",
  5: "COGS",
  6: "EXPENSE",
  7: "OTHER_EXPENSE",
};

const NORMAL_BY_GROUP = {
  ASSET: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
  COGS: "DEBIT",
  EXPENSE: "DEBIT",
  OTHER_EXPENSE: "DEBIT",
};

function mapAccount(legacy) {
  const group = legacy[0];
  const n = legacy.slice(2);

  if (group === "5") {
    if (legacy === "5-1110") {
      return { code: "511100", groupCode: "COGS", parentCode: "510000" };
    }
    if (n[0] === "1") {
      return { code: `6${n}0`, groupCode: "EXPENSE", parentCode: "610000" };
    }
    return { code: `7${n}0`, groupCode: "OTHER_EXPENSE", parentCode: "710000" };
  }

  return {
    code: `${group}${n}0`,
    groupCode: GROUP_BY_DIGIT[group],
    parentCode: null,
  };
}

function buildAccountPlan() {
  const plan = new Map(); // code → account row

  // Root tambahan untuk HPP (workbook menaruh HPP di bawah "BEBAN USAHA").
  plan.set("510000", {
    code: "510000",
    name: "Harga Pokok Penjualan",
    groupCode: "COGS",
    parentCode: null,
    isPostingAllowed: false,
  });

  for (const row of coa) {
    const mapped = mapAccount(row.legacy);
    const isRoot = row.level === 1;

    // Dua L1 di group 5 dipetakan menjadi root 610000 / 710000.
    const code =
      row.legacy === "5-1000" ? "610000" : row.legacy === "5-2000" ? "710000" : mapped.code;

    const parentCode = isRoot ? null : mapped.parentCode;
    const groupCode =
      row.legacy === "5-1000" ? "EXPENSE" : row.legacy === "5-2000" ? "OTHER_EXPENSE" : mapped.groupCode;

    plan.set(code, {
      code,
      name: row.name,
      groupCode,
      parentCode,
      isPostingAllowed: !isRoot,
      legacyCode: row.legacy,
      subtype: SUBTYPES[row.legacy] ?? null,
    });
  }

  return [...plan.values()];
}

async function main() {
  const actor = await prisma.user.findFirst({ where: { email: ACTOR_EMAIL } });
  if (!actor) throw new Error(`User ${ACTOR_EMAIL} tidak ditemukan`);

  let business = await prisma.business.findFirst({ where: { name: BUSINESS_NAME } });

  if (business && !FORCE) {
    console.log(`⚠ Business "${BUSINESS_NAME}" sudah ada (${business.id}).`);
    console.log("  Jalankan dengan FORCE=1 untuk membuat ulang akun & jurnalnya.");
    return;
  }

  if (business && FORCE) {
    const del = await prisma.journalEntry.deleteMany({ where: { businessId: business.id } });
    await prisma.account.deleteMany({ where: { businessId: business.id } });
    console.log(`✓ FORCE: hapus ${del.count} jurnal & semua akun lama`);
  }

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: BUSINESS_NAME,
        type: "BUMDES",
        status: "ACTIVE",
        fiscalYearStart: 1,
        currency: "IDR",
        address: "Data contoh dari workbook pelatihan akuntansi KDKMP",
        createdByUserId: actor.id,
      },
    });
    console.log(`✓ Business dibuat: ${business.name} (${business.id})`);

    await prisma.businessMember.upsert({
      where: { businessId_userId: { businessId: business.id, userId: actor.id } },
      create: { businessId: business.id, userId: actor.id, role: "OWNER" },
      update: { role: "OWNER", isActive: true },
    });
    console.log(`✓ ${ACTOR_EMAIL} → OWNER`);
  }

  const businessId = business.id;

  // ── Fiscal period 2025 ────────────────────────────────────────────────────
  let period = await prisma.fiscalPeriod.findFirst({
    where: { businessId, fiscalYear: 2025 },
  });
  if (!period) {
    period = await prisma.fiscalPeriod.create({
      data: {
        businessId,
        name: "Tahun Buku 2025",
        fiscalYear: 2025,
        startsOn: new Date("2025-01-01T00:00:00Z"),
        endsOn: new Date("2025-12-31T00:00:00Z"),
        status: "OPEN",
      },
    });
    console.log("✓ Fiscal period 2025 dibuat");
  } else {
    console.log("✓ Fiscal period 2025 sudah ada");
  }

  // ── Akun ──────────────────────────────────────────────────────────────────
  const existingAccounts = await prisma.account.count({ where: { businessId } });
  const codeToId = new Map();

  if (existingAccounts === 0) {
    const plan = buildAccountPlan();
    const ordered = [...plan].sort((a, b) => {
      const depth = (c) => (c.endsWith("0000") ? 1 : c.endsWith("00") ? 2 : 3);
      return depth(a.code) - depth(b.code) || a.code.localeCompare(b.code);
    });

    for (const acc of ordered) {
      const parentId = acc.parentCode ? codeToId.get(acc.parentCode) ?? null : null;
      const created = await prisma.account.create({
        data: {
          businessId,
          code: acc.code,
          name: acc.name,
          groupCode: acc.groupCode,
          subtype: acc.subtype ?? null,
          description: acc.legacyCode ? `Kode workbook: ${acc.legacyCode}` : "Root tambahan (pemetaan)",
          normalBalance: NORMAL_BY_GROUP[acc.groupCode],
          parentId,
          parentCode: acc.parentCode,
          isPostingAllowed: acc.isPostingAllowed,
          isSystem: false,
        },
      });
      codeToId.set(acc.code, created.id);
    }
    console.log(`✓ ${codeToId.size} akun dibuat`);
  } else {
    const all = await prisma.account.findMany({ where: { businessId }, select: { id: true, code: true } });
    all.forEach((a) => codeToId.set(a.code, a.id));
    console.log(`✓ ${all.length} akun sudah ada (reuse)`);
  }

  // ── Jurnal ────────────────────────────────────────────────────────────────
  const existingJournals = await prisma.journalEntry.count({ where: { businessId } });
  if (existingJournals > 0 && !FORCE) {
    console.log(`⚠ Jurnal sudah ada (${existingJournals}). Lewati.`);
    return;
  }

  const legacyToCode = new Map();
  for (const row of coa) {
    const mapped = mapAccount(row.legacy);
    const code = row.legacy === "5-1000" ? "610000" : row.legacy === "5-2000" ? "710000" : mapped.code;
    legacyToCode.set(row.legacy, code);
  }

  let seq = 0;
  let skippedLines = 0;

  for (const entry of journal) {
    seq += 1;
    const lines = [];

    for (const line of entry.lines) {
      const code = legacyToCode.get(line.account);
      const accountId = code ? codeToId.get(code) : null;
      if (!accountId) {
        console.log(`  ! akun tidak ditemukan: ${line.account} (${entry.date} ${entry.noBukti})`);
        skippedLines += 1;
        continue;
      }
      const memberMemo = line.member ? ` [Anggota ${line.member}${line.memberName ? " " + line.memberName : ""}]` : "";

      if (line.debit > 0) {
        lines.push({ accountId, side: "DEBIT", amount: BigInt(line.debit), memo: memberMemo.trim() || null });
      }
      if (line.credit > 0) {
        lines.push({ accountId, side: "CREDIT", amount: BigInt(line.credit), memo: memberMemo.trim() || null });
      }
    }

    if (lines.length === 0) continue;

    const totalDebit = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0n);
    const totalCredit = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0n);
    if (totalDebit !== totalCredit) {
      console.log(`  ! tidak seimbang: ${entry.date} ${entry.noBukti} D=${totalDebit} K=${totalCredit}`);
      continue;
    }

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
        lines: {
          create: lines.map((l, i) => ({
            businessId,
            accountId: l.accountId,
            side: l.side,
            amount: l.amount,
            memo: l.memo,
            lineNo: i + 1,
          })),
        },
      },
    });
  }

  console.log(`✓ ${seq} jurnal dibuat${skippedLines ? ` (${skippedLines} baris dilewati)` : ""}`);

  // ── Verifikasi ────────────────────────────────────────────────────────────
  const [accounts, journals, agg] = await Promise.all([
    prisma.account.count({ where: { businessId } }),
    prisma.journalEntry.count({ where: { businessId } }),
    prisma.journalLine.groupBy({
      by: ["side"],
      where: { businessId },
      _sum: { amount: true },
    }),
  ]);

  const debit = agg.find((a) => a.side === "DEBIT")?._sum.amount ?? 0n;
  const credit = agg.find((a) => a.side === "CREDIT")?._sum.amount ?? 0n;

  console.log("\n── VERIFIKASI ─────────────────────────────");
  console.log(`Business : ${business.name}`);
  console.log(`ID       : ${businessId}`);
  console.log(`Akun     : ${accounts}`);
  console.log(`Jurnal   : ${journals}`);
  console.log(`Debit    : Rp ${debit.toLocaleString("id-ID")}`);
  console.log(`Kredit   : Rp ${credit.toLocaleString("id-ID")}`);
  console.log(`Selisih  : Rp ${(debit - credit).toLocaleString("id-ID")} ${debit === credit ? "✓ SEIMBANG" : "✗ ADA SELISIH"}`);
}

main()
  .catch((e) => {
    console.error("GAGAL:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
