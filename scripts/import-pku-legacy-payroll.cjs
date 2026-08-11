const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const businessId = "pku_dc97ee4b3d8e4054b7cd595fe515db12";

function employeeFor(description) {
  const label = description.split("|")[0].trim().replace(/^Gaji\s+/i, "");
  if (label === "Dokter") return { name: "Choirotun Jum’iyyatun Nisak", role: "DOCTOR", isActive: true };
  if (label === "Perawat") return { name: "Laras Nugraheny", role: "NURSE", isActive: true };
  return { name: label, role: "OTHER", isActive: false };
}

async function main() {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { createdByUserId: true } });
  const accounts = await prisma.account.findMany({ where: { businessId, code: { in: ["610001", "230002"] } }, select: { id: true, code: true } });
  const expense = accounts.find((account) => account.code === "610001");
  const payable = accounts.find((account) => account.code === "230002");
  if (!expense || !payable) throw new Error("Akun gaji historis tidak lengkap.");
  const journals = await prisma.journalEntry.findMany({ where: { businessId, status: "POSTED", description: { startsWith: "Gaji", mode: "insensitive" } }, include: { lines: { include: { account: { select: { code: true } } } } }, orderBy: { transactionDate: "asc" } });
  await prisma.$transaction(async (tx) => {
    for (const journal of journals) {
      const exists = await tx.payrollPayment.findUnique({ where: { journalId: journal.id } });
      if (exists) continue;
      const source = employeeFor(journal.description);
      let employee = await tx.employee.findFirst({ where: { businessId, name: source.name } });
      if (!employee) employee = await tx.employee.create({ data: { businessId, ...source } });
      const debit = journal.lines.find((line) => line.side === "DEBIT" && line.accountId === expense.id);
      const credit = journal.lines.find((line) => line.side === "CREDIT" && line.account.code !== "230002");
      if (!debit || !credit || debit.amount !== credit.amount) throw new Error(`Jurnal ${journal.journalNumber} tidak cocok untuk impor.`);
      const period = new Date(Date.UTC(journal.transactionDate.getUTCFullYear(), journal.transactionDate.getUTCMonth(), 1));
      const run = await tx.payrollRun.upsert({ where: { businessId_period: { businessId, period } }, update: {}, create: { businessId, period, status: "PAID", expenseAccountId: expense.id, payableAccountId: payable.id, totalGrossAmount: 0n, totalDeductionAmount: 0n, totalNetAmount: 0n, createdByUserId: business.createdByUserId, paidAt: journal.transactionDate } });
      const item = await tx.payrollItem.upsert({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } }, update: { salaryAmount: { increment: debit.amount }, grossAmount: { increment: debit.amount }, netAmount: { increment: debit.amount }, paidAmount: { increment: debit.amount }, paymentStatus: "PAID" }, create: { businessId, payrollRunId: run.id, employeeId: employee.id, employeeName: employee.name, employeeRole: employee.role, salaryAmount: debit.amount, incentiveAmount: 0n, deductionAmount: 0n, grossAmount: debit.amount, netAmount: debit.amount, paidAmount: debit.amount, paymentStatus: "PAID", notes: "Diimpor dari jurnal lama" } });
      await tx.payrollPayment.create({ data: { businessId, payrollRunId: run.id, payrollItemId: item.id, paymentAccountId: credit.accountId, amount: debit.amount, paidAt: journal.transactionDate, journalId: journal.id, createdByUserId: business.createdByUserId } });
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: "PAID", totalGrossAmount: { increment: debit.amount }, totalNetAmount: { increment: debit.amount }, paidAt: journal.transactionDate } });
    }
  }, { timeout: 60000 });
  console.log(`Imported ${journals.length} legacy salary journals.`);
}

main().finally(() => prisma.$disconnect());
