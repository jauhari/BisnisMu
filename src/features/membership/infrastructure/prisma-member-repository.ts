import { Prisma, PrismaClient } from "@prisma/client";
import { AccountGroupCode, AccountSnapshot, TenantContext } from "../../accounting/domain/accounting-types";
import {
  MemberInstallmentStatus,
  MemberLoanSettings,
  MemberSavingDirection,
  MemberSavingType,
  MemberStatus,
  SavingsBalances,
  emptySavingsBalances,
  readMemberLoanSettings,
} from "../domain/member-types";
import {
  CreateLoanRecordInput,
  CreateMemberInput,
  CreateSavingRecordInput,
  MarkInstallmentPaidInput,
  MemberAuditEvent,
  MemberDetail,
  MemberListFilter,
  MemberLoanInstallmentRecord,
  MemberLoanRecord,
  MemberOverview,
  MemberRecord,
  MemberRepository,
  MemberSavingRecord,
  UpdateMemberInput,
} from "../application/member-repository";

const domainGroupByPrisma = { ASSET: 1, LIABILITY: 2, EQUITY: 3, REVENUE: 4, COGS: 5, EXPENSE: 6, OTHER_EXPENSE: 7 } as const;

export class PrismaMemberRepository implements MemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]> {
    const accounts = await this.prisma.account.findMany({
      where: { businessId: ctx.businessId, id: { in: accountIds } },
    });
    return accounts.map((account) => ({
      id: account.id,
      businessId: account.businessId,
      code: account.code,
      name: account.name,
      groupCode: domainGroupByPrisma[account.groupCode] as AccountGroupCode,
      normalBalance: account.normalBalance,
      subtype: account.subtype,
      isPostingAllowed: account.isPostingAllowed,
      isActive: account.isActive,
    }));
  }

  async getMemberLoanSettings(ctx: TenantContext): Promise<MemberLoanSettings> {
    const business = await this.prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { settings: true },
    });
    return readMemberLoanSettings(business?.settings);
  }

  async listOverviews(ctx: TenantContext, filter: MemberListFilter): Promise<MemberOverview[]> {
    const where: Prisma.MemberWhereInput = { businessId: ctx.businessId };
    if (filter.status) where.status = filter.status;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { memberNumber: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    const members = await this.prisma.member.findMany({ where, orderBy: { memberNumber: "asc" } });
    if (members.length === 0) return [];

    const memberIds = members.map((m) => m.id);
    const [savingsRows, loans] = await Promise.all([
      this.prisma.memberSaving.groupBy({
        by: ["memberId", "type", "direction"],
        where: { businessId: ctx.businessId, memberId: { in: memberIds } },
        _sum: { amount: true },
      }),
      this.prisma.memberLoan.findMany({
        where: { businessId: ctx.businessId, memberId: { in: memberIds }, status: "ACTIVE" },
        select: { id: true, memberId: true },
      }),
    ]);

    const loanIds = loans.map((l) => l.id);
    const pendingInstallments = loanIds.length
      ? await this.prisma.memberLoanInstallment.findMany({
          where: { loanId: { in: loanIds }, status: "PENDING" },
          select: { loanId: true, principalDue: true, dueDate: true },
        })
      : [];

    const savingsByMember = new Map<string, SavingsBalances>();
    for (const row of savingsRows) {
      const current = savingsByMember.get(row.memberId) ?? emptySavingsBalances();
      const amount = row._sum.amount ?? 0n;
      current[row.type as MemberSavingType] += row.direction === "DEPOSIT" ? amount : -amount;
      savingsByMember.set(row.memberId, current);
    }

    const loanOwner = new Map(loans.map((l) => [l.id, l.memberId]));
    const outstandingByMember = new Map<string, bigint>();
    const overdueByMember = new Map<string, number>();
    const activeLoanCount = new Map<string, number>();
    for (const loan of loans) {
      activeLoanCount.set(loan.memberId, (activeLoanCount.get(loan.memberId) ?? 0) + 1);
    }

    const today = new Date();
    for (const inst of pendingInstallments) {
      const memberId = loanOwner.get(inst.loanId);
      if (!memberId) continue;
      outstandingByMember.set(memberId, (outstandingByMember.get(memberId) ?? 0n) + inst.principalDue);
      if (inst.dueDate < today) {
        overdueByMember.set(memberId, (overdueByMember.get(memberId) ?? 0) + 1);
      }
    }

    return members.map((member) => ({
      member: this.toMember(member),
      savings: savingsByMember.get(member.id) ?? emptySavingsBalances(),
      loanOutstanding: outstandingByMember.get(member.id) ?? 0n,
      activeLoans: activeLoanCount.get(member.id) ?? 0,
      overdueInstallments: overdueByMember.get(member.id) ?? 0,
    }));
  }

  async getDetail(ctx: TenantContext, memberId: string): Promise<MemberDetail | null> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, businessId: ctx.businessId } });
    if (!member) return null;

    const [savings, loans, recentSavings] = await Promise.all([
      this.savingsBalances(ctx, memberId),
      this.listLoans(ctx, memberId),
      this.prisma.memberSaving.findMany({
        where: { businessId: ctx.businessId, memberId },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
    ]);

    const withInstallments = await Promise.all(
      loans.map(async (loan) => ({
        ...loan,
        installments: await this.listInstallments(ctx, loan.id),
      })),
    );

    const outstanding = withInstallments
      .filter((l) => l.status === "ACTIVE")
      .flatMap((l) => l.installments)
      .filter((i) => i.status === "PENDING")
      .reduce((sum, i) => sum + i.principalDue, 0n);

    return {
      member: this.toMember(member),
      savings,
      loanOutstanding: outstanding,
      recentSavings: recentSavings.map((s) => this.toSaving(s)),
      loans: withInstallments,
    };
  }

  async findMember(ctx: TenantContext, memberId: string): Promise<MemberRecord | null> {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, businessId: ctx.businessId } });
    return member ? this.toMember(member) : null;
  }

  async findMemberByNumber(ctx: TenantContext, memberNumber: string): Promise<MemberRecord | null> {
    const member = await this.prisma.member.findFirst({
      where: { businessId: ctx.businessId, memberNumber },
    });
    return member ? this.toMember(member) : null;
  }

  async createMember(ctx: TenantContext, input: CreateMemberInput): Promise<MemberRecord> {
    const member = await this.prisma.member.create({
      data: {
        businessId: ctx.businessId,
        memberNumber: input.memberNumber.trim(),
        name: input.name.trim(),
        address: input.address ?? null,
        phone: input.phone ?? null,
        joinedOn: input.joinedOn ?? null,
        status: input.status ?? "ACTIVE",
        notes: input.notes ?? null,
      },
    });
    return this.toMember(member);
  }

  async updateMember(ctx: TenantContext, memberId: string, input: UpdateMemberInput): Promise<MemberRecord> {
    const data: Prisma.MemberUpdateInput = {};
    if (input.memberNumber !== undefined) data.memberNumber = input.memberNumber.trim();
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.address !== undefined) data.address = input.address;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.joinedOn !== undefined) data.joinedOn = input.joinedOn;
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes;

    const member = await this.prisma.member.update({ where: { id: memberId }, data });
    return this.toMember(member);
  }

  async savingsBalances(ctx: TenantContext, memberId: string): Promise<SavingsBalances> {
    const rows = await this.prisma.memberSaving.groupBy({
      by: ["type", "direction"],
      where: { businessId: ctx.businessId, memberId },
      _sum: { amount: true },
    });
    const balances = emptySavingsBalances();
    for (const row of rows) {
      const amount = row._sum.amount ?? 0n;
      balances[row.type as MemberSavingType] += row.direction === "DEPOSIT" ? amount : -amount;
    }
    return balances;
  }

  async createSaving(ctx: TenantContext, input: CreateSavingRecordInput): Promise<MemberSavingRecord> {
    const saving = await this.prisma.memberSaving.create({
      data: {
        businessId: ctx.businessId,
        memberId: input.memberId,
        type: input.type,
        direction: input.direction as MemberSavingDirection,
        accountId: input.accountId,
        transactionDate: input.transactionDate,
        amount: input.amount,
        journalId: input.journalId,
        referenceNumber: input.referenceNumber ?? null,
        note: input.note ?? null,
        createdByUserId: input.createdByUserId,
      },
    });
    return this.toSaving(saving);
  }

  async listSavings(ctx: TenantContext, memberId: string): Promise<MemberSavingRecord[]> {
    const rows = await this.prisma.memberSaving.findMany({
      where: { businessId: ctx.businessId, memberId },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => this.toSaving(r));
  }

  async nextLoanNumber(ctx: TenantContext, date: Date): Promise<string> {
    const prefix = `PJM-${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const count = await this.prisma.memberLoan.count({
      where: { businessId: ctx.businessId, loanNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
  }

  async createLoan(ctx: TenantContext, input: CreateLoanRecordInput): Promise<MemberLoanRecord> {
    const loan = await this.prisma.memberLoan.create({
      data: {
        businessId: ctx.businessId,
        memberId: input.memberId,
        loanNumber: input.loanNumber,
        accountId: input.accountId,
        principal: input.principal,
        interestRateBps: input.interestRateBps,
        interestMethod: input.interestMethod,
        termMonths: input.termMonths,
        disbursedOn: input.disbursedOn,
        journalId: input.journalId,
        note: input.note ?? null,
        createdByUserId: input.createdByUserId,
        installments: {
          create: input.schedule.map((item) => ({
            businessId: ctx.businessId,
            installmentNo: item.installmentNo,
            dueDate: item.dueDate,
            principalDue: item.principalDue,
            interestDue: item.interestDue,
          })),
        },
      },
    });
    return this.toLoan(loan);
  }

  async findLoan(ctx: TenantContext, loanId: string): Promise<MemberLoanRecord | null> {
    const loan = await this.prisma.memberLoan.findFirst({
      where: { id: loanId, businessId: ctx.businessId },
    });
    return loan ? this.toLoan(loan) : null;
  }

  async listLoans(ctx: TenantContext, memberId: string): Promise<MemberLoanRecord[]> {
    const rows = await this.prisma.memberLoan.findMany({
      where: { businessId: ctx.businessId, memberId },
      orderBy: { disbursedOn: "desc" },
    });
    return rows.map((r) => this.toLoan(r));
  }

  async listInstallments(ctx: TenantContext, loanId: string): Promise<MemberLoanInstallmentRecord[]> {
    const rows = await this.prisma.memberLoanInstallment.findMany({
      where: { businessId: ctx.businessId, loanId },
      orderBy: { installmentNo: "asc" },
    });
    return rows.map((r) => this.toInstallment(r));
  }

  async findInstallment(
    ctx: TenantContext,
    loanId: string,
    installmentNo: number,
  ): Promise<MemberLoanInstallmentRecord | null> {
    const row = await this.prisma.memberLoanInstallment.findFirst({
      where: { businessId: ctx.businessId, loanId, installmentNo },
    });
    return row ? this.toInstallment(row) : null;
  }

  async markInstallmentPaid(ctx: TenantContext, input: MarkInstallmentPaidInput): Promise<MemberLoanInstallmentRecord> {
    const current = await this.prisma.memberLoanInstallment.findFirstOrThrow({
      where: { id: input.installmentId, businessId: ctx.businessId },
    });
    const total = current.principalDue + current.interestDue;
    const updated = await this.prisma.memberLoanInstallment.update({
      where: { id: input.installmentId },
      data: {
        status: "PAID" as MemberInstallmentStatus,
        paidAmount: total,
        paidOn: input.paidOn,
        journalId: input.journalId,
      },
    });
    return this.toInstallment(updated);
  }

  async settleLoanIfFullyPaid(ctx: TenantContext, loanId: string): Promise<boolean> {
    const pending = await this.prisma.memberLoanInstallment.count({
      where: { businessId: ctx.businessId, loanId, status: "PENDING" },
    });
    if (pending > 0) return false;
    await this.prisma.memberLoan.update({ where: { id: loanId }, data: { status: "PAID" } });
    return true;
  }

  async createAuditLog(ctx: TenantContext, event: MemberAuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        businessId: ctx.businessId,
        actorUserId: ctx.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        metadata: event.metadata as Prisma.InputJsonValue,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  }

  private toMember(row: {
    id: string;
    businessId: string;
    memberNumber: string;
    name: string;
    address: string | null;
    phone: string | null;
    joinedOn: Date | null;
    status: MemberStatus;
    notes: string | null;
  }): MemberRecord {
    return {
      id: row.id,
      businessId: row.businessId,
      memberNumber: row.memberNumber,
      name: row.name,
      address: row.address,
      phone: row.phone,
      joinedOn: row.joinedOn,
      status: row.status,
      notes: row.notes,
    };
  }

  private toSaving(row: {
    id: string;
    memberId: string;
    type: MemberSavingType;
    direction: MemberSavingDirection;
    accountId: string;
    transactionDate: Date;
    amount: bigint;
    journalId: string | null;
    referenceNumber: string | null;
    note: string | null;
  }): MemberSavingRecord {
    return {
      id: row.id,
      memberId: row.memberId,
      type: row.type,
      direction: row.direction,
      accountId: row.accountId,
      transactionDate: row.transactionDate,
      amount: row.amount,
      journalId: row.journalId,
      referenceNumber: row.referenceNumber,
      note: row.note,
    };
  }

  private toLoan(row: {
    id: string;
    memberId: string;
    loanNumber: string;
    accountId: string;
    principal: bigint;
    interestRateBps: number;
    interestMethod: MemberLoanRecord["interestMethod"];
    termMonths: number;
    disbursedOn: Date;
    status: MemberLoanRecord["status"];
    journalId: string | null;
    note: string | null;
  }): MemberLoanRecord {
    return {
      id: row.id,
      memberId: row.memberId,
      loanNumber: row.loanNumber,
      accountId: row.accountId,
      principal: row.principal,
      interestRateBps: row.interestRateBps,
      interestMethod: row.interestMethod,
      termMonths: row.termMonths,
      disbursedOn: row.disbursedOn,
      status: row.status,
      journalId: row.journalId,
      note: row.note,
    };
  }

  private toInstallment(row: {
    id: string;
    loanId: string;
    installmentNo: number;
    dueDate: Date;
    principalDue: bigint;
    interestDue: bigint;
    paidAmount: bigint;
    paidOn: Date | null;
    status: MemberInstallmentStatus;
    journalId: string | null;
  }): MemberLoanInstallmentRecord {
    return {
      id: row.id,
      loanId: row.loanId,
      installmentNo: row.installmentNo,
      dueDate: row.dueDate,
      principalDue: row.principalDue,
      interestDue: row.interestDue,
      paidAmount: row.paidAmount,
      paidOn: row.paidOn,
      status: row.status,
      journalId: row.journalId,
    };
  }
}
