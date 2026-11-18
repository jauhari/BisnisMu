import { JournalPostingService } from "../../accounting/application/journal-posting-service";
import { TenantContext } from "../../accounting/domain/accounting-types";
import { MemberEngine, installmentTotal } from "../domain/member-engine";
import {
  MemberError,
  MemberLoanSettings,
  MemberSavingDirection,
  MemberSavingType,
  MemberStatus,
  readMemberLoanSettings,
} from "../domain/member-types";
import {
  CreateLoanRecordInput,
  CreateMemberInput,
  CreateSavingRecordInput,
  MemberDetail,
  MemberListFilter,
  MemberOverview,
  MemberRepository,
  UpdateMemberInput,
} from "./member-repository";

export interface MemberCommandMeta {
  businessId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateMemberCommand extends CreateMemberInput, MemberCommandMeta {}
export interface UpdateMemberCommand extends MemberCommandMeta {
  memberId: string;
  memberNumber?: string | undefined;
  name?: string | undefined;
  address?: string | null | undefined;
  phone?: string | null | undefined;
  joinedOn?: Date | null | undefined;
  status?: MemberStatus | undefined;
  notes?: string | null | undefined;
}

export interface RecordSavingCommand extends MemberCommandMeta {
  memberId: string;
  type: MemberSavingType;
  direction: MemberSavingDirection;
  savingsAccountId: string;
  cashAccountId: string;
  transactionDate: Date;
  amount: bigint;
  referenceNumber?: string | undefined;
  note?: string | undefined;
}

export interface CreateLoanCommand extends MemberCommandMeta {
  memberId: string;
  loanAccountId: string;
  cashAccountId: string;
  principal: bigint;
  disbursedOn: Date;
  /** Override setting bisnis; kalau kosong pakai default dari settings. */
  interestRateBps?: number | undefined;
  termMonths?: number | undefined;
  note?: string | undefined;
}

export interface PayInstallmentCommand extends MemberCommandMeta {
  memberId: string;
  loanId: string;
  installmentNo: number;
  cashAccountId: string;
  /** Wajib kalau angsuran mengandung bunga > 0. */
  interestIncomeAccountId?: string | undefined;
  paidOn: Date;
}

export class MemberService {
  constructor(
    private readonly repository: MemberRepository,
    private readonly journalPostingService: JournalPostingService,
    private readonly engine = new MemberEngine(),
  ) {}

  private ctx(command: MemberCommandMeta): TenantContext {
    const ctx: TenantContext = {
      businessId: command.businessId,
      actorUserId: command.actorUserId,
    };
    if (command.requestId !== undefined) ctx.requestId = command.requestId;
    if (command.ipAddress !== undefined) ctx.ipAddress = command.ipAddress;
    if (command.userAgent !== undefined) ctx.userAgent = command.userAgent;
    return ctx;
  }

  async listOverviews(command: MemberCommandMeta & MemberListFilter): Promise<MemberOverview[]> {
    return this.repository.listOverviews(this.ctx(command), {
      ...(command.search ? { search: command.search } : {}),
      ...(command.status ? { status: command.status } : {}),
    });
  }

  async getDetail(command: MemberCommandMeta & { memberId: string }): Promise<MemberDetail> {
    const detail = await this.repository.getDetail(this.ctx(command), command.memberId);
    if (!detail) throw new MemberError("MEMBER_NOT_FOUND", "Anggota tidak ditemukan.", { memberId: command.memberId });
    return detail;
  }

  async getLoanSettings(command: MemberCommandMeta): Promise<MemberLoanSettings> {
    return this.repository.getMemberLoanSettings(this.ctx(command));
  }

  async createMember(command: CreateMemberCommand) {
    this.engine.assertValidMemberNumber(command.memberNumber);
    const ctx = this.ctx(command);

    const existing = await this.repository.findMemberByNumber(ctx, command.memberNumber);
    if (existing) {
      throw new MemberError("MEMBER_NUMBER_TAKEN", "Nomor anggota sudah dipakai.", {
        memberNumber: command.memberNumber,
      });
    }

    const member = await this.repository.createMember(ctx, command);
    await this.repository.createAuditLog(ctx, {
      action: "MEMBER_CREATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "member",
      entityId: member.id,
      metadata: { memberNumber: member.memberNumber, name: member.name },
    });
    return member;
  }

  async updateMember(command: UpdateMemberCommand) {
    const ctx = this.ctx(command);
    const current = await this.repository.findMember(ctx, command.memberId);
    if (!current) throw new MemberError("MEMBER_NOT_FOUND", "Anggota tidak ditemukan.", { memberId: command.memberId });

    if (command.memberNumber && command.memberNumber !== current.memberNumber) {
      this.engine.assertValidMemberNumber(command.memberNumber);
      const existing = await this.repository.findMemberByNumber(ctx, command.memberNumber);
      if (existing) {
        throw new MemberError("MEMBER_NUMBER_TAKEN", "Nomor anggota sudah dipakai.", {
          memberNumber: command.memberNumber,
        });
      }
    }

    const updated = await this.repository.updateMember(ctx, command.memberId, command);
    await this.repository.createAuditLog(ctx, {
      action: "MEMBER_UPDATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "member",
      entityId: updated.id,
      metadata: { changed: Object.keys(command).filter((k) => !["actorUserId", "requestId", "ipAddress", "userAgent", "memberId"].includes(k)) },
    });
    return updated;
  }

  /**
   * Setoran/penarikan simpanan selalu membentuk jurnal, sehingga kartu anggota
   * dan laporan keuangan tidak mungkin berbeda angka.
   */
  async recordSaving(command: RecordSavingCommand) {
    const ctx = this.ctx(command);
    this.engine.assertPositiveAmount(command.amount);

    const member = await this.repository.findMember(ctx, command.memberId);
    if (!member) throw new MemberError("MEMBER_NOT_FOUND", "Anggota tidak ditemukan.", { memberId: command.memberId });

    if (command.direction === "WITHDRAWAL") {
      const balances = await this.repository.savingsBalances(ctx, command.memberId);
      this.engine.assertWithdrawalAllowed(balances[command.type], command.amount);
    }

    const isDeposit = command.direction === "DEPOSIT";
    const journal = await this.journalPostingService.post({
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      transactionDate: command.transactionDate,
      source: "MEMBER_SAVING",
      description: `${isDeposit ? "Setoran" : "Penarikan"} simpanan ${command.type} — ${member.memberNumber} ${member.name}`,
      idempotencyKey: [
        "member-saving",
        ctx.businessId,
        command.memberId,
        command.type,
        command.direction,
        command.transactionDate.toISOString(),
        command.amount.toString(),
        command.referenceNumber ?? command.note ?? "",
      ].join(":"),
      lines: [
        { accountId: command.cashAccountId, side: isDeposit ? "DEBIT" : "CREDIT", amount: command.amount },
        { accountId: command.savingsAccountId, side: isDeposit ? "CREDIT" : "DEBIT", amount: command.amount },
      ],
    });

    const input: CreateSavingRecordInput = {
      memberId: command.memberId,
      type: command.type,
      direction: command.direction,
      accountId: command.savingsAccountId,
      transactionDate: command.transactionDate,
      amount: command.amount,
      journalId: journal.journalId,
      createdByUserId: ctx.actorUserId,
      ...(command.referenceNumber !== undefined ? { referenceNumber: command.referenceNumber } : {}),
      ...(command.note !== undefined ? { note: command.note } : {}),
    };

    const saving = await this.repository.createSaving(ctx, input);
    await this.repository.createAuditLog(ctx, {
      action: "MEMBER_SAVING_POSTED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "member_saving",
      entityId: saving.id,
      metadata: {
        memberId: command.memberId,
        type: command.type,
        direction: command.direction,
        amount: command.amount.toString(),
        journalId: journal.journalId,
      },
    });

    const balances = await this.repository.savingsBalances(ctx, command.memberId);
    return { saving, journal, balances };
  }

  /**
   * Pencairan pinjaman: jurnal + jadwal angsuran flat. Bunga diambil dari
   * setting bisnis saat pencairan lalu DISIMPAN sebagai snapshot di pinjaman,
   * sehingga perubahan setting tidak mengubah pinjaman yang sudah berjalan.
   */
  async createLoan(command: CreateLoanCommand) {
    const ctx = this.ctx(command);
    const member = await this.repository.findMember(ctx, command.memberId);
    if (!member) throw new MemberError("MEMBER_NOT_FOUND", "Anggota tidak ditemukan.", { memberId: command.memberId });

    const settings = await this.repository.getMemberLoanSettings(ctx);
    const interestRateBps = command.interestRateBps ?? settings.defaultInterestRateBps;
    const termMonths = command.termMonths ?? settings.defaultTermMonths;

    const schedule = this.engine.buildFlatSchedule({
      principal: command.principal,
      interestRateBps,
      termMonths,
      disbursedOn: command.disbursedOn,
    });

    const loanNumber = await this.repository.nextLoanNumber(ctx, command.disbursedOn);

    const journal = await this.journalPostingService.post({
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      transactionDate: command.disbursedOn,
      source: "MEMBER_LOAN",
      description: `Pencairan pinjaman ${loanNumber} — ${member.memberNumber} ${member.name}`,
      idempotencyKey: ["member-loan", ctx.businessId, loanNumber].join(":"),
      lines: [
        { accountId: command.loanAccountId, side: "DEBIT", amount: command.principal },
        { accountId: command.cashAccountId, side: "CREDIT", amount: command.principal },
      ],
    });

    const input: CreateLoanRecordInput = {
      memberId: command.memberId,
      loanNumber,
      accountId: command.loanAccountId,
      principal: command.principal,
      interestRateBps,
      interestMethod: "FLAT",
      termMonths,
      disbursedOn: command.disbursedOn,
      journalId: journal.journalId,
      createdByUserId: ctx.actorUserId,
      schedule,
      ...(command.note !== undefined ? { note: command.note } : {}),
    };

    const loan = await this.repository.createLoan(ctx, input);
    await this.repository.createAuditLog(ctx, {
      action: "MEMBER_LOAN_CREATED",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "member_loan",
      entityId: loan.id,
      metadata: {
        memberId: command.memberId,
        loanNumber,
        principal: command.principal.toString(),
        interestRateBps,
        termMonths,
        journalId: journal.journalId,
      },
    });

    const installments = await this.repository.listInstallments(ctx, loan.id);
    return { loan, installments, journal, settings };
  }

  async payInstallment(command: PayInstallmentCommand) {
    const ctx = this.ctx(command);

    const loan = await this.repository.findLoan(ctx, command.loanId);
    if (!loan || loan.memberId !== command.memberId) {
      throw new MemberError("LOAN_NOT_FOUND", "Pinjaman tidak ditemukan untuk anggota ini.", {
        loanId: command.loanId,
        memberId: command.memberId,
      });
    }

    const installment = await this.repository.findInstallment(ctx, command.loanId, command.installmentNo);
    if (!installment) {
      throw new MemberError("INSTALLMENT_NOT_FOUND", "Angsuran tidak ditemukan.", {
        loanId: command.loanId,
        installmentNo: command.installmentNo,
      });
    }
    if (installment.status === "PAID") {
      throw new MemberError("INSTALLMENT_ALREADY_PAID", "Angsuran ini sudah dibayar.", {
        installmentId: installment.id,
      });
    }

    const total = installmentTotal(installment);
    this.engine.assertInstallmentPayment(installment, total);

    if (installment.interestDue > 0n && !command.interestIncomeAccountId) {
      throw new MemberError("ACCOUNT_NOT_FOUND", "Akun pendapatan bunga wajib diisi untuk angsuran berbunga.", {
        installmentId: installment.id,
      });
    }

    const lines = [
      { accountId: command.cashAccountId, side: "DEBIT" as const, amount: total },
      { accountId: loan.accountId, side: "CREDIT" as const, amount: installment.principalDue },
    ];
    if (installment.interestDue > 0n) {
      lines.push({
        accountId: command.interestIncomeAccountId as string,
        side: "CREDIT" as const,
        amount: installment.interestDue,
      });
    }

    const journal = await this.journalPostingService.post({
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      transactionDate: command.paidOn,
      source: "MEMBER_LOAN_INSTALLMENT",
      description: `Angsuran ke-${installment.installmentNo} pinjaman ${loan.loanNumber}`,
      idempotencyKey: ["member-installment", ctx.businessId, installment.id].join(":"),
      lines,
    });

    const paid = await this.repository.markInstallmentPaid(ctx, {
      installmentId: installment.id,
      paidOn: command.paidOn,
      journalId: journal.journalId,
    });

    const loanSettled = await this.repository.settleLoanIfFullyPaid(ctx, loan.id);

    await this.repository.createAuditLog(ctx, {
      action: "MEMBER_INSTALLMENT_PAID",
      businessId: ctx.businessId,
      actorUserId: ctx.actorUserId,
      entityType: "member_installment",
      entityId: paid.id,
      metadata: {
        loanId: loan.id,
        installmentNo: paid.installmentNo,
        amount: total.toString(),
        journalId: journal.journalId,
        loanSettled,
      },
    });

    return { installment: paid, journal, loanSettled };
  }
}

export function memberStatusLabel(status: MemberStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "INACTIVE":
      return "Nonaktif";
    case "RESIGNED":
      return "Keluar";
  }
}
