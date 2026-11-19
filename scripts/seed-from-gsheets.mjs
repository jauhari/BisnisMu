#!/usr/bin/env node
/**
 * Seed script: Import CoA + Jurnal dari CSV T_JURNAL WaterByur
 * Usage: node scripts/seed-from-gsheets.mjs [businessId]
 *
 * Yang dilakukan:
 * 1. Hapus semua journal_lines dan journal_entries bisnis ini
 * 2. Hapus semua accounts bisnis ini
 * 3. Buat ulang CoA dari akun yang dipakai di jurnal + parent hierarchy
 * 4. Buka fiscal period yang dibutuhkan
 * 5. Import semua jurnal dari CSV
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

const CSV_PATH =
  process.env.CSV_PATH ||
  "/Users/dhw/Downloads/BUMKal Hanyukupi - T_JURNAL.csv";

// ─── Parse satu baris CSV (handle quoted fields dengan koma di dalam) ─────────
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── "  15.410.000 " → BigInt(15410000) ──────────────────────────────────────
function parseAmount(str) {
  if (!str || !str.trim()) return 0n;
  const cleaned = str.replace(/\./g, "").replace(/,/g, "").replace(/\s/g, "");
  if (!cleaned || cleaned === "0") return 0n;
  try {
    return BigInt(cleaned);
  } catch {
    return 0n;
  }
}

// ─── "DD/MM/YYYY" → Date UTC ──────────────────────────────────────────────────
function parseDate(str) {
  const [d, m, y] = str.split("/");
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

// ─── Tentukan group & normalBalance dari kode akun ───────────────────────────
function accountMeta(code) {
  const prefix = code.substring(0, 1);
  switch (prefix) {
    case "1": return { group: "ASSET",   normal: "DEBIT"  };
    case "2": return { group: "LIABILITY", normal: "CREDIT" };
    case "3": return { group: "EQUITY",  normal: "CREDIT" };
    case "4": return { group: "REVENUE", normal: "CREDIT" };
    case "5": return { group: "COGS",    normal: "DEBIT"  };
    case "6": return { group: "EXPENSE", normal: "DEBIT"  };
    default:  return { group: "EXPENSE", normal: "DEBIT"  };
  }
}

// ─── Parent hierarchy — tambah parent jika belum ada di akun ─────────────────
// Setiap akun 6-digit punya parent 4-digit, yang punya parent 6-digit header.
// Hanya level yang dipakai di jurnal yang dibuat + parent chain-nya.
const PARENT_NAMES = {
  // Aset
  "110000": "ASET LANCAR",
  "110100": "KAS",
  "160000": "HARTA TETAP TIDAK BERWUJUD",
  "160100": "HARTA TAK BERWUJUD",
  // Pendapatan
  "410000": "PENDAPATAN USAHA",
  // Biaya
  "610000": "BIAYA OPERASIONAL",
};

function getParentCode(code) {
  // 6-digit posting account → parent 6-digit header
  if (code === "110101") return "110100";
  if (code === "160101") return "160100";
  // 4xxxx → 410000
  if (/^41/.test(code) && code !== "410000") return "410000";
  // 61xxxx → 610000
  if (/^61/.test(code) && code !== "610000") return "610000";
  // 110100 → 110000
  if (code === "110100") return "110000";
  // 160100 → 160000
  if (code === "160100") return "160000";
  return null;
}

// ─── Baca CSV dan return baris data valid ─────────────────────────────────────
function readCSV(path) {
  const content = readFileSync(path, "utf-8");
  const lines = content.split(/\r?\n/);
  const rows = [];

  for (let i = 6; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 11) continue;

    const date    = cols[1].trim();
    const no      = cols[2].trim();
    const desc    = cols[3].trim();
    const acctRaw = cols[8].trim();
    const debitRaw  = cols[9];
    const creditRaw = cols[10];

    if (!date || !acctRaw || !acctRaw.includes("|")) continue;
    if (!no || !/^\d+$/.test(no)) continue;

    const pipeIdx = acctRaw.indexOf("|");
    const acctCode = acctRaw.substring(0, pipeIdx).trim();
    const acctName = acctRaw.substring(pipeIdx + 1).trim();

    const debit  = parseAmount(debitRaw);
    const credit = parseAmount(creditRaw);
    if (debit === 0n && credit === 0n) continue;

    rows.push({
      date,
      no: parseInt(no),
      desc,
      acctCode,
      acctName,
      debit,
      credit,
    });
  }
  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const businessIdArg = process.argv[2];

  // Cari business
  let business;
  if (businessIdArg) {
    business = await prisma.business.findUniqueOrThrow({ where: { id: businessIdArg } });
  } else {
    business = await prisma.business.findFirst({
      where: { name: { contains: "WaterByur", mode: "insensitive" } },
    });
    if (!business) {
      business = await prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
    }
  }
  if (!business) throw new Error("Tidak ada business di DB. Daftar dulu.");

  const { id: businessId, createdByUserId: actorUserId } = business;
  console.log(`\n✓ Business: ${business.name} (${businessId})`);

  // ── 1. Baca CSV ─────────────────────────────────────────────────────────────
  console.log(`\n→ Membaca CSV: ${CSV_PATH}`);
  const rows = readCSV(CSV_PATH);
  console.log(`✓ ${rows.length} baris data ditemukan`);

  // ── 2. Kumpulkan akun unik dari jurnal ──────────────────────────────────────
  const postingAccounts = new Map(); // code → name
  for (const r of rows) {
    if (!postingAccounts.has(r.acctCode)) {
      postingAccounts.set(r.acctCode, r.acctName);
    }
  }
  console.log(`✓ ${postingAccounts.size} akun unik ditemukan di jurnal`);

  // ── 3. Hapus data lama ──────────────────────────────────────────────────────
  console.log(`\n→ Menghapus data jurnal lama...`);
  const delLines = await prisma.journalLine.deleteMany({ where: { businessId } });
  console.log(`  ✓ Hapus ${delLines.count} journal lines`);

  const delEntries = await prisma.journalEntry.deleteMany({ where: { businessId } });
  console.log(`  ✓ Hapus ${delEntries.count} journal entries`);

  console.log(`→ Menghapus akun lama...`);
  const delAccts = await prisma.account.deleteMany({ where: { businessId } });
  console.log(`  ✓ Hapus ${delAccts.count} akun`);

  // ── 4. Buat CoA baru ────────────────────────────────────────────────────────
  console.log(`\n→ Membuat CoA...`);

  // Tentukan semua kode yang perlu dibuat (posting + parents)
  const allCodes = new Set(postingAccounts.keys());
  for (const code of postingAccounts.keys()) {
    let cur = code;
    while (true) {
      const p = getParentCode(cur);
      if (!p) break;
      allCodes.add(p);
      cur = p;
    }
  }

  // Build urutan insert: root dulu, leaf terakhir
  // Sort by code length asc, then code asc
  const sortedCodes = [...allCodes].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });

  const accountMap = {}; // code → id

  for (const code of sortedCodes) {
    const isPosting = postingAccounts.has(code);
    const name = isPosting
      ? postingAccounts.get(code)
      : (PARENT_NAMES[code] ?? `Group ${code}`);
    const parentCode = getParentCode(code);
    const parentId = parentCode ? accountMap[parentCode] ?? null : null;
    const { group, normal } = accountMeta(code);

    const created = await prisma.account.create({
      data: {
        businessId,
        code,
        name,
        groupCode: group,
        normalBalance: normal,
        isPostingAllowed: isPosting,
        parentId,
        parentCode: parentCode ?? null,
      },
    });
    accountMap[code] = created.id;
    console.log(`  + ${code} ${name}${isPosting ? "" : " [header]"}`);
  }
  console.log(`✓ ${Object.keys(accountMap).length} akun dibuat`);

  // ── 5. Buka fiscal periods yang dibutuhkan ──────────────────────────────────
  const yearsNeeded = new Set(
    rows.map((r) => {
      const [, , y] = r.date.split("/");
      return Number(y);
    })
  );

  const periodMap = {}; // year → period id
  for (const year of yearsNeeded) {
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
          endsOn: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
          status: "OPEN",
        },
      });
      console.log(`✓ Fiscal period ${year} dibuat`);
    } else if (period.status !== "OPEN") {
      await prisma.fiscalPeriod.update({
        where: { id: period.id },
        data: { status: "OPEN" },
      });
      console.log(`✓ Fiscal period ${year} dibuka kembali`);
    } else {
      console.log(`✓ Fiscal period ${year} sudah ada`);
    }
    periodMap[year] = period.id;
  }

  // ── 6. Kelompokkan baris CSV jadi journal entries ───────────────────────────
  const entryMap = new Map(); // "date_no" → { date, no, desc, lines[] }
  for (const r of rows) {
    const key = `${r.date}_${r.no}`;
    if (!entryMap.has(key)) {
      entryMap.set(key, { date: r.date, no: r.no, desc: r.desc, lines: [] });
    }
    entryMap.get(key).lines.push({
      acctCode: r.acctCode,
      debit: r.debit,
      credit: r.credit,
    });
  }
  const entries = [...entryMap.values()];
  console.log(`\n→ Memposting ${entries.length} jurnal...`);

  // ── 7. Post jurnal ──────────────────────────────────────────────────────────
  let posted = 0, skipped = 0, errors = 0;
  let nextNum = 1;

  for (const entry of entries) {
    const totalDebit  = entry.lines.reduce((s, l) => s + l.debit,  0n);
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0n);

    if (totalDebit !== totalCredit) {
      skipped++;
      console.log(
        `  ✗ Skip ${entry.date} #${entry.no}: tidak balance (D=${totalDebit} C=${totalCredit})`
      );
      continue;
    }

    const txDate = parseDate(entry.date);
    const [, , y] = entry.date.split("/");
    const fiscalPeriodId = periodMap[Number(y)];
    const idempKey = `import:waterbyur:${entry.date}:${entry.no}`;

    try {
      const journalNumber = `JU${String(nextNum).padStart(5, "0")}`;
      await prisma.journalEntry.create({
        data: {
          businessId,
          journalNumber,
          transactionDate: txDate,
          description: entry.desc || `Import ${entry.date} #${entry.no}`,
          source: "MANUAL_JOURNAL",
          fiscalPeriodId,
          postedByUserId: actorUserId,
          totalDebit,
          totalCredit,
          idempotencyKey: idempKey,
          lines: {
            create: entry.lines.map((l, idx) => ({
              businessId,
              accountId: accountMap[l.acctCode],
              side:   l.debit > 0n ? "DEBIT" : "CREDIT",
              amount: l.debit > 0n ? l.debit : l.credit,
              memo:   entry.desc || null,
              lineNo: idx + 1,
            })),
          },
        },
      });
      nextNum++;
      posted++;
    } catch (err) {
      errors++;
      console.log(`  ✗ Error ${entry.date} #${entry.no}: ${err.message}`);
    }
  }

  console.log(`\n✅ Selesai!`);
  console.log(`   Jurnal diposting : ${posted}`);
  console.log(`   Dilewati         : ${skipped}`);
  console.log(`   Error            : ${errors}`);
}

main()
  .catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
