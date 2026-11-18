import { describe, expect, it } from "vitest";
import { JournalRepository, PostedJournalResult } from "../../src/features/accounting/application/journal-repository";
import { JournalPostingService } from "../../src/features/accounting/application/journal-posting-service";
import {
  AccountSnapshot,
  FiscalPeriodSnapshot,
  TenantContext as AccountingTenantContext,
  ValidatedJournal,
} from "../../src/features/accounting/domain/accounting-types";
import { MemberService } from "../../src/features/membership/application/member-service";
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
} from "../../src/features/membership/application/member-repository";
import { MemberError, SavingsBalances, emptySavingsBalances } from "../../src/features/membership/domain/member-types";

const ACCOUNTS: AccountSnapshot[] = [
  { id: "acc-kas", businessId: "biz-1", code: "111100", name: "Kas", groupCode: 1, normalBalance: "DEBIT", subtype: "cash", isPostingAllowed: true, isActive: true },
  { id: "acc-simpok", businessId: "biz-1", code: "311000", name: "Simpanan Pokok", groupCode: 3, normalBalance: "CREDIT", subtype: "equity", isPostingAllowed: true, isActive: true },
  { id: "acc-piutang", businessId: "biz-1", code: "112300", name: "Pinjaman Diberikan", groupCode: 1, normalBalance: "DEBIT", subtype: "receivable", isPostingAllowed: true, isActive: true },
  { id: "acc-bunga", businessId: "biz-1", code: "413000", name: "Pendapatan Bunga", groupCode: 4, normalBalance: "CREDIT", subtype: "other_revenue", isPostingAllowed: true, isActive: true },
];

class PostingRepo implements JournalRepository {
  posted: ValidatedJournal[] = [];
  constructor(private readonly accounts: AccountSnapshot[]) {}
  async findAccountsForPosting(ctx: AccountingTenantContext, ids: string[]) {
    return this.accounts.filter((a) => a.businessId === ctx.businessId && ids.includes(a.id));
  }
  async findOpenFiscalPeriod(): Promise<FiscalPeriodSnapshot> {
    return { id: "fp-1", businessId: "biz-1", startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isClosed: false };
  }
  async findPostedJournalByIdempotencyKey(): Promise<PostedJournalResult | null> {
    return null;
  }
  async createPostedJournal(_ctx: AccountingTenantContext, journal: ValidatedJournal): Promise<PostedJournalResult> {
    this.posted.push(journal);
    const total = journal.lines.reduce((sum, line) => sum + line.amount, 0n) / 2n;
    return { journalId: `j-${this.posted.length}`, journalNumber: `JV-${this.posted.length}`, postedAt: new Date(), totalDebit: total, totalCredit: total };
  }
  async createAuditLog(): Promise<void> {}
}

class FakeMemberRepo implements MemberRepository {
  members = new Map<string, MemberRecord>();
  savings: MemberSavingRecord[] = [];
  loans: MemberLoanRecord[] = [];
  installments: MemberLoanInstallmentRecord[] = [];
  balances: SavingsBalances = emptySavingsBalances();
  createdLoanInput: CreateLoanRecordInput | null = null;
  audits: MemberAuditEvent[] = [];

  async findAccounts() {
    return ACCOUNTS;
  }
  async getMemberLoanSettings() {
    return { defaultInterestRateBps: 100, defaultTermMonths: 6 };
  }
  async listOverviews(_ctx: AccountingTenantContext, _filter: MemberListFilter): Promise<MemberOverview[]> {
    return [];
  }
  async getDetail(): Promise<MemberDetail | null> {
    return null;
  }
  async findMember(_ctx: AccountingTenantContext, memberId: string) {
    return this.members.get(memberId) ?? null;
  }
  async findMemberByNumber(_ctx: AccountingTenantContext, memberNumber: string) {
    return [...this.members.values()].find((m) => m.memberNumber === memberNumber) ?? null;
  }
  async createMember(_ctx: AccountingTenantContext, input: CreateMemberInput): Promise<MemberRecord> {
    const member: MemberRecord = {
      id: `m-${this.members.size + 1}`,
      businessId: "biz-1",
      memberNumber: input.memberNumber,
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      joinedOn: input.joinedOn ?? null,
      status: input.status ?? "ACTIVE",
      notes: input.notes ?? null,
    };
    this.members.set(member.id, member);
    return member;
  }
  async updateMember(_ctx: AccountingTenantContext, memberId: string, input: UpdateMemberInput): Promise<MemberRecord> {
    const current = this.members.get(memberId)!;
    const updated = { ...current, ...input } as MemberRecord;
    this.members.set(memberId, updated);
    return updated;
  }
  async savingsBalances(): Promise<SavingsBalances> {
    return this.balances;
  }
  async createSaving(_ctx: AccountingTenantContext, input: CreateSavingRecordInput): Promise<MemberSavingRecord> {
    const record: MemberSavingRecord = {
      id: `s-${this.savings.length + 1}`,
      memberId: input.memberId,
      type: input.type,
      direction: input.direction,
      accountId: input.accountId,
      transactionDate: input.transactionDate,
      amount: input.amount,
      journalId: input.journalId,
      referenceNumber: input.referenceNumber ?? null,
      note: input.note ?? null,
    };
    this.savings.push(record);
    return record;
  }
  async listSavings() {
    return this.savings;
  }
  async nextLoanNumber() {
    return "PJM-202601-0001";
  }
  async createLoan(_ctx: AccountingTenantContext, input: CreateLoanRecordInput): Promise<MemberLoanRecord> {
    this.createdLoanInput = input;
    const loan: MemberLoanRecord = {
      id: "l-1",
      memberId: input.memberId,
      loanNumber: input.loanNumber,
      accountId: input.accountId,
      principal: input.principal,
      interestRateBps: input.interestRateBps,
      interestMethod: input.interestMethod,
      termMonths: input.termMonths,
      disbursedOn: input.disbursedOn,
      status: "ACTIVE",
      journalId: input.journalId,
      note: input.note ?? null,
    };
    this.loans.push(loan);
    this.installments = input.schedule.map((item, index) => ({
      id: `i-${index + 1}`,
      loanId: loan.id,
      installmentNo: item.installmentNo,
      dueDate: item.dueDate,
      principalDue: item.principalDue,
      interestDue: item.interestDue,
      paidAmount: 0n,
      paidOn: null,
      status: "PENDING",
      journalId: null,
    }));
    return loan;
  }
  async findLoan() {
    return this.loans[0] ?? null;
  }
  async listLoans() {
    return this.loans;
  }
  async listInstallments() {
    return this.installments;
  }
  async findInstallment(_ctx: AccountingTenantContext, _loanId: string, installmentNo: number) {
    return this.installments.find((i) => i.installmentNo === installmentNo) ?? null;
  }
  async markInstallmentPaid(_ctx: AccountingTenantContext, input: MarkInstallmentPaidInput) {
    const installment = this.installments.find((i) => i.id === input.installmentId)!;
    installment.status = "PAID";
    installment.paidAmount = installment.principalDue + installment.interestDue;
    installment.paidOn = input.paidOn;
    installment.journalId = input.journalId;
    return installment;
  }
  async settleLoanIfFullyPaid() {
    const pending = this.installments.some((i) => i.status === "PENDING");
    if (!pending) this.loans[0]!.status = "PAID";
    return !pending;
  }
  async createAuditLog(_ctx: AccountingTenantContext, event: MemberAuditEvent): Promise<void> {
    this.audits.push(event);
  }
}

function build() {
  const journalRepo = new PostingRepo(ACCOUNTS);
  const memberRepo = new FakeMemberRepo();
  const service = new MemberService(memberRepo, new JournalPostingService(journalRepo));
  return { service, memberRepo, journalRepo };
}

const ctx = { businessId: "biz-1", actorUserId: "user-1" };

describe("MemberService — anggota", () => {
  it("menolak nomor anggota ganda", async () => {
    const { service } = build();
    await service.createMember({ ...ctx, memberNumber: "1001", name: "Aulia" });
    await expect(service.createMember({ ...ctx, memberNumber: "1001", name: "Lain" })).rejects.toBeInstanceOf(MemberError);
  });
});

describe("MemberService — simpanan", () => {
  it("menolak penarikan melebihi saldo", async () => {
    const { service, memberRepo } = build();
    const member = await service.createMember({ ...ctx, memberNumber: "1001", name: "Aulia" });
    memberRepo.balances = { POKOK: 100_000n, WAJIB: 0n, SUKARELA: 0n };

    await expect(
      service.recordSaving({
        ...ctx,
        memberId: member.id,
        type: "POKOK",
        direction: "WITHDRAWAL",
        savingsAccountId: "acc-simpok",
        cashAccountId: "acc-kas",
        transactionDate: new Date("2026-01-05"),
        amount: 150_000n,
      }),
    ).rejects.toBeInstanceOf(MemberError);
  });

  it("setoran membentuk jurnal debit kas / kredit simpanan", async () => {
    const { service, journalRepo } = build();
    const member = await service.createMember({ ...ctx, memberNumber: "1002", name: "Febriyanti" });

    const result = await service.recordSaving({
      ...ctx,
      memberId: member.id,
      type: "WAJIB",
      direction: "DEPOSIT",
      savingsAccountId: "acc-simpok",
      cashAccountId: "acc-kas",
      transactionDate: new Date("2026-01-05"),
      amount: 200_000n,
    });

    expect(result.saving.amount).toBe(200_000n);
    const journal = journalRepo.posted[0]!;
    const cash = journal.lines.find((l) => l.account.id === "acc-kas")!;
    const savings = journal.lines.find((l) => l.account.id === "acc-simpok")!;
    expect(cash.side).toBe("DEBIT");
    expect(savings.side).toBe("CREDIT");
    expect(savings.amount).toBe(200_000n);
  });
});

describe("MemberService — pinjaman", () => {
  it("memakai setting bisnis lalu menyimpannya sebagai snapshot", async () => {
    const { service, memberRepo, journalRepo } = build();
    const member = await service.createMember({ ...ctx, memberNumber: "1003", name: "Citra" });

    const result = await service.createLoan({
      ...ctx,
      memberId: member.id,
      loanAccountId: "acc-piutang",
      cashAccountId: "acc-kas",
      principal: 1_200_000n,
      disbursedOn: new Date("2026-01-10"),
    });

    expect(result.loan.interestRateBps).toBe(100);
    expect(result.loan.termMonths).toBe(6);
    expect(result.installments).toHaveLength(6);
    expect(memberRepo.createdLoanInput?.interestRateBps).toBe(100);

    const totalPrincipal = result.installments.reduce((sum, i) => sum + i.principalDue, 0n);
    expect(totalPrincipal).toBe(1_200_000n);

    const journal = journalRepo.posted[0]!;
    expect(journal.lines.find((l) => l.account.id === "acc-piutang")?.side).toBe("DEBIT");
    expect(journal.lines.find((l) => l.account.id === "acc-kas")?.side).toBe("CREDIT");
  });

  it("pembayaran angsuran memisahkan pokok dan bunga", async () => {
    const { service, journalRepo } = build();
    const member = await service.createMember({ ...ctx, memberNumber: "1004", name: "Intan" });
    await service.createLoan({
      ...ctx,
      memberId: member.id,
      loanAccountId: "acc-piutang",
      cashAccountId: "acc-kas",
      principal: 1_200_000n,
      disbursedOn: new Date("2026-01-10"),
      interestRateBps: 100,
      termMonths: 3,
    });

    const payment = await service.payInstallment({
      ...ctx,
      memberId: member.id,
      loanId: "l-1",
      installmentNo: 1,
      cashAccountId: "acc-kas",
      interestIncomeAccountId: "acc-bunga",
      paidOn: new Date("2026-02-10"),
    });

    // 400.000 pokok + 12.000 bunga (1% dari 1,2 jt)
    const journal = journalRepo.posted[1]!;
    expect(journal.lines.find((l) => l.account.id === "acc-kas")?.amount).toBe(412_000n);
    expect(journal.lines.find((l) => l.account.id === "acc-piutang")?.amount).toBe(400_000n);
    expect(journal.lines.find((l) => l.account.id === "acc-bunga")?.amount).toBe(12_000n);
    expect(payment.installment.status).toBe("PAID");
  });

  it("menolak pembayaran ganda pada angsuran yang sama", async () => {
    const { service } = build();
    const member = await service.createMember({ ...ctx, memberNumber: "1005", name: "Maulana" });
    await service.createLoan({
      ...ctx,
      memberId: member.id,
      loanAccountId: "acc-piutang",
      cashAccountId: "acc-kas",
      principal: 600_000n,
      disbursedOn: new Date("2026-01-10"),
      interestRateBps: 0,
      termMonths: 2,
    });

    await service.payInstallment({
      ...ctx,
      memberId: member.id,
      loanId: "l-1",
      installmentNo: 1,
      cashAccountId: "acc-kas",
      paidOn: new Date("2026-02-10"),
    });

    await expect(
      service.payInstallment({
        ...ctx,
        memberId: member.id,
        loanId: "l-1",
        installmentNo: 1,
        cashAccountId: "acc-kas",
        paidOn: new Date("2026-03-10"),
      }),
    ).rejects.toBeInstanceOf(MemberError);
  });
});
