import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BUSINESS_ID = "cmwlz491r0000gumsip19rbrs";

const accounts = await prisma.account.findMany({
  where: { businessId: BUSINESS_ID },
  select: { id: true, code: true, name: true, groupCode: true, normalBalance: true, subtype: true },
  orderBy: { code: "asc" },
});

const lines = await prisma.journalLine.groupBy({
  by: ["accountId", "side"],
  where: { businessId: BUSINESS_ID },
  _sum: { amount: true },
});

const byAccount = new Map();
for (const l of lines) {
  const cur = byAccount.get(l.accountId) ?? { DEBIT: 0n, CREDIT: 0n };
  cur[l.side] = l._sum.amount ?? 0n;
  byAccount.set(l.accountId, cur);
}

const rows = accounts.map((a) => {
  const t = byAccount.get(a.id) ?? { DEBIT: 0n, CREDIT: 0n };
  const net = a.normalBalance === "DEBIT" ? t.DEBIT - t.CREDIT : t.CREDIT - t.DEBIT;
  return { ...a, debit: t.DEBIT, credit: t.CREDIT, net };
});

const aktif = rows.filter((r) => r.debit !== 0n || r.credit !== 0n);

console.log("── SALDO PER AKUN (hanya yang bergerak) ──");
for (const r of aktif) {
  console.log(
    `${r.code}  ${r.name.padEnd(34)} ${r.groupCode.padEnd(13)} ${r.net.toLocaleString("id-ID").padStart(16)}`,
  );
}

const sumGroup = (g) => aktif.filter((r) => r.groupCode === g).reduce((s, r) => s + r.net, 0n);
const revenue = sumGroup("REVENUE");
const cogs = sumGroup("COGS");
const expense = sumGroup("EXPENSE");
const other = sumGroup("OTHER_EXPENSE");
const asset = sumGroup("ASSET");
const liability = sumGroup("LIABILITY");
const equity = sumGroup("EQUITY");

const shu = revenue - cogs - expense - other;

console.log("\n── IKHTISAR ──");
console.log(`Pendapatan          Rp ${revenue.toLocaleString("id-ID")}`);
console.log(`HPP                 Rp ${cogs.toLocaleString("id-ID")}`);
console.log(`Beban Usaha         Rp ${expense.toLocaleString("id-ID")}`);
console.log(`Beban/Pend. Lain    Rp ${other.toLocaleString("id-ID")}`);
console.log(`SHU (laba)          Rp ${shu.toLocaleString("id-ID")}`);
console.log(`\nTotal Aset          Rp ${asset.toLocaleString("id-ID")}`);
console.log(`Total Liabilitas    Rp ${liability.toLocaleString("id-ID")}`);
console.log(`Total Ekuitas       Rp ${equity.toLocaleString("id-ID")}`);
console.log(`Liab + Ekuitas      Rp ${(liability + equity).toLocaleString("id-ID")}`);
console.log(`Selisih Neraca      Rp ${(asset - liability - equity).toLocaleString("id-ID")}`);
console.log(`Cek: Aset - (Liab+Ekuitas+SHU) = Rp ${(asset - liability - equity - shu).toLocaleString("id-ID")}`);

await prisma.$disconnect();
