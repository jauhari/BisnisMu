import { PrismaClient } from "@prisma/client";
import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { PostJournalCommand } from "../../accounting/application/journal-repository";

interface Ctx { businessId: string; actorUserId: string; }

export interface CreateInstallmentPlanCommand {
  businessId: string;
  actorUserId: string;
  customerId: string;
  description: string;
  totalAmount: bigint;
  downPayment?: bigint;
  tenor: number;
  startDate: Date;
  arAccountId: string;
  revenueAccountId?: string; // jika diisi → posting piutang (mode mandiri); kosong → piutang sudah diposting (mis. dari POS)
  dpCashAccountId?: string;  // wajib bila ada uang muka
  salesOrderId?: string;
}

export interface PayInstallmentCommand {
  businessId: string;
  actorUserId: string;
  scheduleId: string;
  cashAccountId: string;
  amount: bigint;
  paymentDate: Date;
}

export class InstallmentService {
  constructor(private readonly prisma: PrismaClient, private readonly journal: JournalPostingService) {}

  async createPlan(c: CreateInstallmentPlanCommand) {
    const dp = c.downPayment ?? 0n;
    if (!Number.isInteger(c.tenor) || c.tenor < 1) throw new Error("Tenor minimal 1.");
    if (c.totalAmount <= 0n) throw new Error("Total harus lebih dari 0.");
    if (dp < 0n || dp >= c.totalAmount) throw new Error("Uang muka tidak valid (harus 0 sampai kurang dari total).");
    const financed = c.totalAmount - dp;
    const planNumber = await this.nextPlanNumber(c.businessId, c.startDate);

    if (c.revenueAccountId) {
      await this.post(c, c.startDate, "INSTALLMENT_SALE", planNumber, c.description, [
        { accountId: c.arAccountId, side: "DEBIT", amount: c.totalAmount },
        { accountId: c.revenueAccountId, side: "CREDIT", amount: c.totalAmount },
      ]);
    }
    if (dp > 0n) {
      if (!c.dpCashAccountId) throw new Error("Akun kas untuk uang muka wajib dipilih.");
      await this.post(c, c.startDate, "INSTALLMENT_DP", planNumber, "Uang muka " + c.description, [
        { accountId: c.dpCashAccountId, side: "DEBIT", amount: dp },
        { accountId: c.arAccountId, side: "CREDIT", amount: dp },
      ]);
    }

    const schedule = this.buildSchedule(financed, c.tenor, c.startDate);
    return this.prisma.installmentPlan.create({
      data: {
        businessId: c.businessId,
        planNumber,
        customerId: c.customerId,
        salesOrderId: c.salesOrderId ?? null,
        description: c.description,
        totalAmount: c.totalAmount,
        downPayment: dp,
        financedAmount: financed,
        tenor: c.tenor,
        startDate: c.startDate,
        arAccountId: c.arAccountId,
        createdByUserId: c.actorUserId,
        schedules: { create: schedule.map((s) => ({ businessId: c.businessId, sequence: s.sequence, dueDate: s.dueDate, amount: s.amount })) },
      },
      include: { schedules: { orderBy: { sequence: "asc" } } },
    });
  }

  async payInstallment(c: PayInstallmentCommand) {
    const sch = await this.prisma.installmentSchedule.findFirst({ where: { id: c.scheduleId, businessId: c.businessId }, include: { plan: true } });
    if (!sch) throw new Error("Jadwal angsuran tidak ditemukan.");
    if (c.amount <= 0n) throw new Error("Jumlah bayar harus lebih dari 0.");
    const remaining = sch.amount - sch.paidAmount;
    if (c.amount > remaining) throw new Error("Pembayaran melebihi sisa angsuran (" + remaining.toString() + ").");

    const posted = await this.post(c, c.paymentDate, "INSTALLMENT_PAYMENT", sch.id + ":" + sch.paidAmount.toString(), "Angsuran " + sch.plan.planNumber + " #" + sch.sequence, [
      { accountId: c.cashAccountId, side: "DEBIT", amount: c.amount },
      { accountId: sch.plan.arAccountId, side: "CREDIT", amount: c.amount },
    ]);

    const newPaid = sch.paidAmount + c.amount;
    const status = newPaid >= sch.amount ? "PAID" : "PARTIAL";
    await this.prisma.installmentSchedule.update({ where: { id: sch.id, businessId: c.businessId }, data: { paidAmount: newPaid, status, paidAt: status === "PAID" ? c.paymentDate : null, postedJournalId: posted.journalId } });

    const unpaid = await this.prisma.installmentSchedule.count({ where: { businessId: c.businessId, planId: sch.planId, status: { not: "PAID" } } });
    if (unpaid === 0) await this.prisma.installmentPlan.update({ where: { id: sch.planId, businessId: c.businessId }, data: { status: "COMPLETED" } });

    return this.prisma.installmentPlan.findFirst({ where: { id: sch.planId, businessId: c.businessId }, include: { schedules: { orderBy: { sequence: "asc" } } } });
  }

  async listPlans(ctx: Ctx) {
    return this.prisma.installmentPlan.findMany({ where: { businessId: ctx.businessId }, orderBy: { createdAt: "desc" }, include: { schedules: { orderBy: { sequence: "asc" } } } });
  }

  private buildSchedule(financed: bigint, tenor: number, startDate: Date): Array<{ sequence: number; dueDate: Date; amount: bigint }> {
    const tenorBig = BigInt(tenor);
    const base = financed / tenorBig;
    const remainder = financed - base * tenorBig;
    const out: Array<{ sequence: number; dueDate: Date; amount: bigint }> = [];
    for (let i = 0; i < tenor; i++) {
      const due = new Date(startDate);
      due.setMonth(due.getMonth() + i + 1);
      out.push({ sequence: i + 1, dueDate: due, amount: base + (i === tenor - 1 ? remainder : 0n) });
    }
    return out;
  }

  private async nextPlanNumber(businessId: string, date: Date): Promise<string> {
    const ym = date.toISOString().slice(0, 7).replace("-", "");
    const count = await this.prisma.installmentPlan.count({ where: { businessId } });
    return "CIC-" + ym + "-" + String(count + 1).padStart(4, "0");
  }

  private async post(ctx: Ctx, date: Date, source: string, sourceId: string, description: string, lines: PostJournalCommand["lines"]) {
    const command: PostJournalCommand = {
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      transactionDate: date,
      source,
      sourceId,
      description,
      idempotencyKey: source + ":" + ctx.businessId + ":" + sourceId,
      lines,
    };
    return this.journal.post(command);
  }
}
