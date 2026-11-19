import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const OWNER_EMAIL = argumentValue("--owner") ?? "barookahjaya@gmail.com";
const BUSINESS_NAME = argumentValue("--business-name") ?? "PKU Ponjong";
const SOURCE_PATH = argumentValue("--source");
const APPLY = process.argv.includes("--apply");

if (!SOURCE_PATH) {
  throw new Error("Missing --source <workbook.xlsx>. Run without --apply first to validate the import plan.");
}

const resolvedSourcePath = path.resolve(SOURCE_PATH);
if (!existsSync(resolvedSourcePath)) {
  throw new Error(`Source workbook was not found: ${resolvedSourcePath}`);
}

const prisma = new PrismaClient();

function argumentValue(flag) {
  const value = process.argv.find((argument) => argument.startsWith(`${flag}=`));
  return value?.slice(flag.length + 1);
}

function cell(sheet, row, column) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: column })];
}

function textValue(sheet, row, column) {
  const value = cell(sheet, row, column)?.w ?? cell(sheet, row, column)?.v;
  return value === undefined || value === null ? "" : String(value).trim();
}

function rawValue(sheet, row, column) {
  return cell(sheet, row, column)?.v;
}

function parseDmy(value, sourceRow) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new Error(`Invalid date at JURNAL row ${sourceRow}: ${value}`);

  const [, day, month, year] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date at JURNAL row ${sourceRow}: ${value}`);
  }
  return date;
}

function legacyAccountCode(value) {
  return value.split("|")[0].trim();
}

function mapAccountCode(sourceCode) {
  if (!/^\d{6}$/.test(sourceCode)) {
    throw new Error(`Invalid source account code: ${sourceCode}`);
  }
  // ExAct VS uses group 7 for other income and group 8 for other expenses.
  // BisnisMu follows SAK EMKM: group 4 is revenue and group 7 is other expense.
  if (sourceCode.startsWith("7")) return `4001${sourceCode.slice(-2)}`;
  if (sourceCode.startsWith("8")) return `7${sourceCode.slice(1)}`;
  return sourceCode;
}

function parentCodeFor(code) {
  if (code.endsWith("0000")) return null;
  if (code.endsWith("00")) return `${code.slice(0, 2)}0000`;
  return `${code.slice(0, 3)}000`;
}

function groupFor(code) {
  const group = Number(code[0]);
  if (!Number.isInteger(group) || group < 1 || group > 7) {
    throw new Error(`Mapped account code is outside BisnisMu groups 1-7: ${code}`);
  }
  return group;
}

function normalBalanceFor(group) {
  return [1, 5, 6, 7].includes(group) ? "DEBIT" : "CREDIT";
}

function parseAccounts(workbook) {
  const sheet = workbook.Sheets.AKUN;
  if (!sheet) throw new Error("Workbook is missing AKUN sheet.");

  const accounts = [];
  const sourceCodes = new Set();
  const mappedCodes = new Set();

  for (let row = 11; row < 1000; row += 1) {
    const sourceCode = textValue(sheet, row, 1);
    const name = textValue(sheet, row, 2);
    const sourceType = textValue(sheet, row, 3);
    if (!sourceCode && !name) continue;
    if (!sourceCode || !name) throw new Error(`Incomplete account definition at AKUN row ${row + 1}.`);
    if (sourceCodes.has(sourceCode)) throw new Error(`Duplicate source account code: ${sourceCode}`);

    const code = mapAccountCode(sourceCode);
    if (mappedCodes.has(code)) throw new Error(`Mapped account code collision: ${code}`);

    sourceCodes.add(sourceCode);
    mappedCodes.add(code);
    accounts.push({
      sourceCode,
      code,
      name,
      sourceType: sourceType || null,
      group: groupFor(code),
      parentCode: parentCodeFor(code),
      isPostingAllowed: Boolean(sourceType),
    });
  }

  if (accounts.length === 0) throw new Error("No accounts were found in AKUN.");

  for (const account of accounts) {
    if (!account.parentCode) continue;
    const candidates = [
      account.parentCode,
      `${account.code.slice(0, 2)}0000`,
      `${account.code[0]}00000`,
    ];
    account.parentCode = candidates.find((candidate) => candidate !== account.code && mappedCodes.has(candidate)) ?? null;
  }

  return accounts;
}

function parseOpeningBalances(workbook, accountBySourceCode) {
  const sheet = workbook.Sheets.AKUN;
  const balances = [];
  let debitTotal = 0n;
  let creditTotal = 0n;

  for (let row = 11; row < 1000; row += 1) {
    const sourceCode = textValue(sheet, row, 1);
    const debit = Number(rawValue(sheet, row, 4) ?? 0);
    const credit = Number(rawValue(sheet, row, 5) ?? 0);
    if (!sourceCode || (!debit && !credit)) continue;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 || (debit && credit)) {
      throw new Error(`Invalid opening balance at AKUN row ${row + 1}.`);
    }

    const account = accountBySourceCode.get(sourceCode);
    if (!account?.isPostingAllowed) throw new Error(`Opening balance references a non-posting account: ${sourceCode}`);
    if (debit) {
      balances.push({ sourceRow: row + 1, sourceCode, code: account.code, side: "DEBIT", amount: BigInt(debit) });
      debitTotal += BigInt(debit);
    }
    if (credit) {
      balances.push({ sourceRow: row + 1, sourceCode, code: account.code, side: "CREDIT", amount: BigInt(credit) });
      creditTotal += BigInt(credit);
    }
  }

  if (debitTotal !== creditTotal) {
    throw new Error(`Opening balances are not balanced: debit ${debitTotal}, credit ${creditTotal}.`);
  }
  return { balances, debitTotal, creditTotal };
}

function parseJournals(workbook, accountBySourceCode) {
  const sheet = workbook.Sheets.JURNAL;
  if (!sheet) throw new Error("Workbook is missing JURNAL sheet.");

  const journals = [];
  for (let row = 9; row < 1000; row += 1) {
    const dateText = textValue(sheet, row, 1);
    const description = textValue(sheet, row, 3);
    const helperCode = textValue(sheet, row, 4);
    const division = textValue(sheet, row, 5);
    const project = textValue(sheet, row, 6);
    const debitSourceCode = legacyAccountCode(textValue(sheet, row, 7));
    const creditSourceCode = legacyAccountCode(textValue(sheet, row, 8));
    const amountValue = rawValue(sheet, row, 9);

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) continue;
    if (!debitSourceCode && !creditSourceCode && Number(amountValue ?? 0) === 0) continue;

    const amount = Number(amountValue);
    if (!description || !debitSourceCode || !creditSourceCode || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error(`Incomplete or invalid journal at JURNAL row ${row + 1}.`);
    }

    const debitAccount = accountBySourceCode.get(debitSourceCode);
    const creditAccount = accountBySourceCode.get(creditSourceCode);
    if (!debitAccount?.isPostingAllowed || !creditAccount?.isPostingAllowed) {
      throw new Error(`Journal row ${row + 1} references a missing or non-posting account.`);
    }

    const metadata = [
      helperCode ? `Kode bantu: ${helperCode}` : null,
      division ? `Divisi: ${division}` : null,
      project ? `Project: ${project}` : null,
    ].filter(Boolean);

    journals.push({
      sourceRow: row + 1,
      transactionDate: parseDmy(dateText, row + 1),
      description: [description, ...metadata].join(" | "),
      debitCode: debitAccount.code,
      creditCode: creditAccount.code,
      amount: BigInt(amount),
    });
  }

  if (journals.length === 0) throw new Error("No valid journal rows were found in JURNAL.");
  return journals.sort((a, b) => a.transactionDate - b.transactionDate || a.sourceRow - b.sourceRow);
}

function extractDimensionRows(workbook, sheetName, firstDataRow, codePattern) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = [];

  for (let row = firstDataRow; row < 1000; row += 1) {
    const code = textValue(sheet, row, 1);
    if (!codePattern.test(code)) continue;
    rows.push({
      sourceRow: row + 1,
      code,
      description: textValue(sheet, row, 2),
    });
  }
  return rows;
}

function extractFixedAssets(workbook) {
  const sheet = workbook.Sheets.DAFTAR_ASET;
  if (!sheet) return [];
  const headers = Array.from({ length: 18 }, (_, index) => textValue(sheet, 7, index + 1));
  const assets = [];

  for (let row = 8; row < 1000; row += 1) {
    const code = textValue(sheet, row, 1);
    if (!/^AKT-\d+$/i.test(code)) continue;
    const asset = { sourceRow: row + 1 };
    for (let column = 1; column <= 18; column += 1) {
      const header = headers[column - 1] || `column_${column}`;
      const value = textValue(sheet, row, column);
      if (value) asset[header] = value;
    }
    assets.push(asset);
  }
  return assets;
}

function journalPrefix(transactionDate) {
  const year = transactionDate.getUTCFullYear();
  const month = String(transactionDate.getUTCMonth() + 1).padStart(2, "0");
  return `JV-${year}${month}-`;
}

function createJournalNumber(sequences, transactionDate) {
  const prefix = journalPrefix(transactionDate);
  const nextSequence = (sequences.get(prefix) ?? 0) + 1;
  sequences.set(prefix, nextSequence);
  return `${prefix}${String(nextSequence).padStart(5, "0")}`;
}

function fiscalYearFor(date) {
  return date.getUTCFullYear();
}

function buildPlan() {
  const sourceBuffer = readFileSync(resolvedSourcePath);
  const workbook = XLSX.read(sourceBuffer, { type: "buffer", cellDates: true });
  const accounts = parseAccounts(workbook);
  const accountBySourceCode = new Map(accounts.map((account) => [account.sourceCode, account]));
  const opening = parseOpeningBalances(workbook, accountBySourceCode);
  const journals = parseJournals(workbook, accountBySourceCode);
  const years = [...new Set([2024, ...journals.map((journal) => fiscalYearFor(journal.transactionDate))])].sort();
  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
  const codeMappings = accounts
    .filter((account) => account.sourceCode !== account.code)
    .map((account) => ({ sourceCode: account.sourceCode, targetCode: account.code }));

  return {
    accounts,
    opening,
    journals,
    years,
    sourceHash,
    metadata: {
      legacyImport: {
        source: "ExAct VS / PKU24 Google Sheet",
        sourceSha256: sourceHash,
        accountCodeMappings: codeMappings,
        divisions: extractDimensionRows(workbook, "KARYAWAN", 10, /^D\d+$/i),
        projects: extractDimensionRows(workbook, "PROJECT", 10, /^P\d+$/i),
        fixedAssets: extractFixedAssets(workbook),
      },
    },
  };
}

function printablePlan(plan) {
  const journalTotal = plan.journals.reduce((total, journal) => total + journal.amount, 0n);
  return {
    mode: APPLY ? "apply" : "dry-run",
    businessName: BUSINESS_NAME,
    ownerEmail: OWNER_EMAIL,
    sourceSha256: plan.sourceHash,
    accounts: plan.accounts.length,
    mappedLegacyAccounts: plan.metadata.legacyImport.accountCodeMappings.length,
    openingBalances: plan.opening.balances.length,
    openingDebitCredit: plan.opening.debitTotal.toString(),
    fiscalPeriods: plan.years,
    journals: plan.journals.length,
    journalDebitCredit: journalTotal.toString(),
    preservedMetadata: {
      divisions: plan.metadata.legacyImport.divisions.length,
      projects: plan.metadata.legacyImport.projects.length,
      fixedAssets: plan.metadata.legacyImport.fixedAssets.length,
    },
  };
}

async function importPlan(plan, owner) {
  return prisma.$transaction(async (tx) => {
    const existingBusiness = await tx.business.findFirst({ where: { name: BUSINESS_NAME }, select: { id: true } });
    if (existingBusiness) throw new Error(`Business already exists with name ${BUSINESS_NAME}: ${existingBusiness.id}`);

    const importedAt = new Date();
    const businessId = `pku_${randomUUID().replaceAll("-", "")}`;
    await tx.business.create({
      data: {
        id: businessId,
        name: BUSINESS_NAME,
        type: "UMKM",
        fiscalYearStart: 1,
        currency: "IDR",
        createdByUserId: owner.id,
        settings: {
          ...plan.metadata,
          legacyImport: {
            ...plan.metadata.legacyImport,
            importedAt: importedAt.toISOString(),
          },
        },
      },
    });

    await tx.businessMember.create({
      data: { businessId, userId: owner.id, role: "OWNER", isActive: true },
    });

    const accountIdByCode = new Map(plan.accounts.map((account) => [account.code, `pkuacct_${randomUUID().replaceAll("-", "")}`]));
    const accountDepth = (account) => account.parentCode ? (account.parentCode.endsWith("0000") ? 2 : 3) : 1;
    for (const depth of [1, 2, 3]) {
      const accountRows = plan.accounts.filter((account) => accountDepth(account) === depth);
      if (accountRows.length === 0) continue;
      await tx.account.createMany({
        data: accountRows.map((account) => ({
          id: accountIdByCode.get(account.code),
          businessId,
          code: account.code,
          name: account.name,
          groupCode: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE", "OTHER_EXPENSE"][account.group - 1],
          subtype: account.sourceType,
          description: account.sourceCode === account.code ? "Imported from PKU24" : `Imported from PKU24 code ${account.sourceCode}`,
          normalBalance: normalBalanceFor(account.group),
          parentCode: account.parentCode,
          parentId: account.parentCode ? accountIdByCode.get(account.parentCode) : null,
          isPostingAllowed: account.isPostingAllowed,
          isActive: true,
        })),
      });
    }

    const periods = new Map(plan.years.map((year) => [year, {
      id: `pkufiscal_${randomUUID().replaceAll("-", "")}`,
      startsOn: new Date(Date.UTC(year, 0, 1)),
      endsOn: new Date(Date.UTC(year, 11, 31)),
    }]));
    await tx.fiscalPeriod.createMany({
      data: plan.years.map((year) => ({
        id: periods.get(year).id,
        businessId,
        name: `Tahun Buku ${year}`,
        fiscalYear: year,
        startsOn: periods.get(year).startsOn,
        endsOn: periods.get(year).endsOn,
        status: "OPEN",
        isClosed: false,
      })),
    });

    const sequences = new Map();
    const openingPeriod = periods.get(2024);
    if (!openingPeriod) throw new Error("Opening fiscal period is missing.");
    const openingJournal = {
      id: `pkujournal_${randomUUID().replaceAll("-", "")}`,
      journalNumber: createJournalNumber(sequences, openingPeriod.startsOn),
      transactionDate: openingPeriod.startsOn,
      source: "BEGINNING_BALANCE",
      sourceId: "legacy-pku24:opening-balance:2024",
      description: "Saldo awal import PKU24",
      totalDebit: plan.opening.debitTotal,
      totalCredit: plan.opening.creditTotal,
      postedByUserId: owner.id,
      idempotencyKey: `legacy-pku24:${plan.sourceHash}:opening-2024`,
      fiscalPeriodId: openingPeriod.id,
    };
    const journalRows = [openingJournal];
    const journalLineRows = plan.opening.balances.map((balance, index) => ({
      businessId,
      journalId: openingJournal.id,
      accountId: accountIdByCode.get(balance.code),
      side: balance.side,
      amount: balance.amount,
      lineNo: index + 1,
      memo: `Saldo awal dari AKUN row ${balance.sourceRow}`,
    }));

    await tx.beginningBalance.createMany({
      data: plan.opening.balances.map((balance) => ({
        businessId,
        fiscalPeriodId: openingPeriod.id,
        accountId: accountIdByCode.get(balance.code),
        side: balance.side,
        amount: balance.amount,
        status: "POSTED",
        postedJournalId: openingJournal.id,
        postedByUserId: owner.id,
        postedAt: importedAt,
        createdByUserId: owner.id,
      })),
    });

    for (const journal of plan.journals) {
      const period = periods.get(fiscalYearFor(journal.transactionDate));
      if (!period) throw new Error(`Missing fiscal period for JURNAL row ${journal.sourceRow}.`);
      const journalRow = {
        id: `pkujournal_${randomUUID().replaceAll("-", "")}`,
        businessId,
        fiscalPeriodId: period.id,
        journalNumber: createJournalNumber(sequences, journal.transactionDate),
        transactionDate: journal.transactionDate,
        source: "LEGACY_EXACT_VS",
        sourceId: `legacy-pku24:journal:${journal.sourceRow}`,
        description: journal.description,
        totalDebit: journal.amount,
        totalCredit: journal.amount,
        postedByUserId: owner.id,
        postedAt: importedAt,
        idempotencyKey: `legacy-pku24:${plan.sourceHash}:journal-${journal.sourceRow}`,
      };
      journalRows.push(journalRow);
      journalLineRows.push(
        { businessId, journalId: journalRow.id, accountId: accountIdByCode.get(journal.debitCode), side: "DEBIT", amount: journal.amount, lineNo: 1, memo: `PKU24 JURNAL row ${journal.sourceRow}` },
        { businessId, journalId: journalRow.id, accountId: accountIdByCode.get(journal.creditCode), side: "CREDIT", amount: journal.amount, lineNo: 2, memo: `PKU24 JURNAL row ${journal.sourceRow}` },
      );
    }

    await tx.journalEntry.createMany({
      data: journalRows.map((journal) => ({ ...journal, businessId, status: "POSTED", postedAt: importedAt })),
    });
    await tx.journalLine.createMany({ data: journalLineRows });

    const journalTotal = plan.journals.reduce((total, journal) => total + journal.amount, 0n) + plan.opening.debitTotal;
    const [journalCount, lineCount, totals] = await Promise.all([
      tx.journalEntry.count({ where: { businessId } }),
      tx.journalLine.count({ where: { businessId } }),
      tx.journalEntry.aggregate({ where: { businessId }, _sum: { totalDebit: true, totalCredit: true } }),
    ]);
    if (journalCount !== journalRows.length || lineCount !== journalLineRows.length || totals._sum.totalDebit !== journalTotal || totals._sum.totalCredit !== journalTotal) {
      throw new Error("Post-import reconciliation failed; transaction will be rolled back.");
    }

    const auditEntries = [
      { action: "BUSINESS_CREATED", entityType: "business", entityId: businessId, metadata: { source: "PKU24", sourceHash: plan.sourceHash, import: true } },
      ...plan.accounts.map((account) => ({ action: "ACCOUNT_CREATED", entityType: "account", entityId: accountIdByCode.get(account.code), metadata: { sourceCode: account.sourceCode, targetCode: account.code, import: true } })),
      ...plan.years.map((year) => ({ action: "FISCAL_PERIOD_OPENED", entityType: "fiscal_period", entityId: periods.get(year).id, metadata: { fiscalYear: year, import: true } })),
      { action: "BEGINNING_BALANCE_POSTED", entityType: "beginning_balance", entityId: openingJournal.id, metadata: { import: true, source: "PKU24" } },
      ...journalRows.map((journal) => ({ action: "JOURNAL_POSTED", entityType: "journal", entityId: journal.id, metadata: { journalNumber: journal.journalNumber, source: journal.source, import: true } })),
    ];
    await tx.auditLog.createMany({
      data: auditEntries.map((entry) => ({ businessId, actorUserId: owner.id, ...entry })),
    });

    return {
      businessId,
      journalCount,
      lineCount,
      totalDebitCredit: journalTotal.toString(),
      accountCount: plan.accounts.length,
      fiscalPeriods: plan.years,
    };
  }, { timeout: 60000 });
}

async function main() {
  const plan = buildPlan();
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, email: true } });
  if (!owner) throw new Error(`Owner user was not found: ${OWNER_EMAIL}`);

  const existingBusiness = await prisma.business.findFirst({ where: { name: BUSINESS_NAME }, select: { id: true, createdByUserId: true } });
  if (existingBusiness) throw new Error(`Business already exists with name ${BUSINESS_NAME}: ${existingBusiness.id}`);

  console.log(JSON.stringify(printablePlan(plan), null, 2));
  if (!APPLY) return;

  const result = await importPlan(plan, owner);
  console.log(JSON.stringify({ status: "imported", ...result }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
