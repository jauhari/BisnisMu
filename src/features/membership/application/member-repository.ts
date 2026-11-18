import { AccountSnapshot, TenantContext } from "../../accounting/domain/accounting-types";
import {
  MemberInstallmentStatus,
  MemberLoanInterestMethod,
  MemberLoanSettings,
  MemberLoanStatus,
  MemberSavingDirection,
  MemberSavingType,
  MemberStatus,
  PlannedInstallment,
  SavingsBalances,
} from "../domain/member-types";

export interface MemberRecord {
  id: string;
  businessId: string;
  memberNumber: string;
  name: string;
  address: string | null;
  phone: string | null;
  joinedOn: Date | null;
  status: MemberStatus;
  notes: string | null;
}

export interface MemberSavingRecord {
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
}

export interface MemberLoanRecord {
  id: string;
  memberId: string;
  loanNumber: string;
  accountId: string;
  principal: bigint;
  interestRateBps: number;
  interestMethod: MemberLoanInterestMethod;
  termMonths: number;
  disbursedOn: Date;
  status: MemberLoanStatus;
  journalId: string | null;
  note: string | null;
}

export interface MemberLoanInstallmentRecord {
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
}

export interface MemberOverview {
  member: MemberRecord;
  savings: SavingsBalances;
  loanOutstanding: bigint;
  activeLoans: number;
  overdueInstallments: number;
}

export interface MemberDetail {
  member: MemberRecord;
  savings: SavingsBalances;
  loanOutstanding: bigint;
  recentSavings: MemberSavingRecord[];
  loans: Array<MemberLoanRecord & { installments: MemberLoanInstallmentRecord[] }>;
}

export interface MemberListFilter {
  search?: string;
  status?: MemberStatus | undefined;
}

export interface CreateMemberInput {
  memberNumber: string;
  name: string;
  address?: string | null | undefined;
  phone?: string | null | undefined;
  joinedOn?: Date | null | undefined;
  status?: MemberStatus | undefined;
  notes?: string | null | undefined;
}

export interface UpdateMemberInput {
  memberNumber?: string | undefined;
  name?: string | undefined;
  address?: string | null | undefined;
  phone?: string | null | undefined;
  joinedOn?: Date | null | undefined;
  status?: MemberStatus | undefined;
  notes?: string | null | undefined;
}

export interface CreateSavingRecordInput {
  memberId: string;
  type: MemberSavingType;
  direction: MemberSavingDirection;
  accountId: string;
  transactionDate: Date;
  amount: bigint;
  journalId: string;
  referenceNumber?: string | null | undefined;
  note?: string | null | undefined;
  createdByUserId: string;
}

export interface CreateLoanRecordInput {
  memberId: string;
  loanNumber: string;
  accountId: string;
  principal: bigint;
  interestRateBps: number;
  interestMethod: MemberLoanInterestMethod;
  termMonths: number;
  disbursedOn: Date;
  journalId: string;
  note?: string | null | undefined;
  createdByUserId: string;
  schedule: PlannedInstallment[];
}

export interface MarkInstallmentPaidInput {
  installmentId: string;
  paidOn: Date;
  journalId: string;
}

export interface MemberAuditEvent {
  action: "MEMBER_CREATED" | "MEMBER_UPDATED" | "MEMBER_SAVING_POSTED" | "MEMBER_LOAN_CREATED" | "MEMBER_INSTALLMENT_PAID";
  businessId: string;
  actorUserId: string;
  entityType: "member" | "member_saving" | "member_loan" | "member_installment";
  entityId?: string;
  metadata: Record<string, unknown>;
}

export interface MemberRepository {
  findAccounts(ctx: TenantContext, accountIds: string[]): Promise<AccountSnapshot[]>;
  getMemberLoanSettings(ctx: TenantContext): Promise<MemberLoanSettings>;

  listOverviews(ctx: TenantContext, filter: MemberListFilter): Promise<MemberOverview[]>;
  getDetail(ctx: TenantContext, memberId: string): Promise<MemberDetail | null>;
  findMember(ctx: TenantContext, memberId: string): Promise<MemberRecord | null>;
  findMemberByNumber(ctx: TenantContext, memberNumber: string): Promise<MemberRecord | null>;
  createMember(ctx: TenantContext, input: CreateMemberInput): Promise<MemberRecord>;
  updateMember(ctx: TenantContext, memberId: string, input: UpdateMemberInput): Promise<MemberRecord>;
  savingsBalances(ctx: TenantContext, memberId: string): Promise<SavingsBalances>;

  createSaving(ctx: TenantContext, input: CreateSavingRecordInput): Promise<MemberSavingRecord>;
  listSavings(ctx: TenantContext, memberId: string): Promise<MemberSavingRecord[]>;

  nextLoanNumber(ctx: TenantContext, date: Date): Promise<string>;
  createLoan(ctx: TenantContext, input: CreateLoanRecordInput): Promise<MemberLoanRecord>;
  findLoan(ctx: TenantContext, loanId: string): Promise<MemberLoanRecord | null>;
  listLoans(ctx: TenantContext, memberId: string): Promise<MemberLoanRecord[]>;
  listInstallments(ctx: TenantContext, loanId: string): Promise<MemberLoanInstallmentRecord[]>;
  findInstallment(ctx: TenantContext, loanId: string, installmentNo: number): Promise<MemberLoanInstallmentRecord | null>;
  markInstallmentPaid(ctx: TenantContext, input: MarkInstallmentPaidInput): Promise<MemberLoanInstallmentRecord>;
  settleLoanIfFullyPaid(ctx: TenantContext, loanId: string): Promise<boolean>;

  createAuditLog(ctx: TenantContext, event: MemberAuditEvent): Promise<void>;
}
