-- Modul Keanggotaan Koperasi (additive).
-- Hanya CREATE. Tidak ada DROP/ALTER terhadap tabel existing.
--
-- Catatan: migration ini ditulis manual karena `prisma migrate diff` ikut
-- menghasilkan DROP untuk tabel yang ada di database tetapi tidak ada di
-- schema.prisma lokal (employees, payroll_runs, payroll_items,
-- payroll_payments). Tabel itu berasal dari migration 20260811*/20260813*/
-- 20260818* yang belum ada di repo ini — bukan bagian perubahan ini.

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESIGNED');

-- CreateEnum
CREATE TYPE "MemberSavingType" AS ENUM ('POKOK', 'WAJIB', 'SUKARELA');

-- CreateEnum
CREATE TYPE "MemberSavingDirection" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "MemberLoanStatus" AS ENUM ('ACTIVE', 'PAID', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "MemberLoanInterestMethod" AS ENUM ('FLAT');

-- CreateEnum
CREATE TYPE "MemberInstallmentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "joined_on" DATE,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_savings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "type" "MemberSavingType" NOT NULL,
    "direction" "MemberSavingDirection" NOT NULL,
    "account_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "journal_id" TEXT,
    "reference_number" TEXT,
    "note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_savings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_loans" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "loan_number" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "principal" BIGINT NOT NULL,
    "interest_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "interest_method" "MemberLoanInterestMethod" NOT NULL DEFAULT 'FLAT',
    "term_months" INTEGER NOT NULL,
    "disbursed_on" DATE NOT NULL,
    "status" "MemberLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "journal_id" TEXT,
    "note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_loan_installments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_due" BIGINT NOT NULL,
    "interest_due" BIGINT NOT NULL,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "paid_on" DATE,
    "status" "MemberInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "journal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_loan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "members_business_id_status_idx" ON "members"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "members_business_id_member_number_key" ON "members"("business_id", "member_number");

-- CreateIndex
CREATE INDEX "member_savings_business_id_member_id_type_idx" ON "member_savings"("business_id", "member_id", "type");

-- CreateIndex
CREATE INDEX "member_savings_business_id_transaction_date_idx" ON "member_savings"("business_id", "transaction_date");

-- CreateIndex
CREATE INDEX "member_loans_business_id_member_id_status_idx" ON "member_loans"("business_id", "member_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "member_loans_business_id_loan_number_key" ON "member_loans"("business_id", "loan_number");

-- CreateIndex
CREATE INDEX "member_loan_installments_business_id_status_due_date_idx" ON "member_loan_installments"("business_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "member_loan_installments_loan_id_installment_no_key" ON "member_loan_installments"("loan_id", "installment_no");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_savings" ADD CONSTRAINT "member_savings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_savings" ADD CONSTRAINT "member_savings_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_savings" ADD CONSTRAINT "member_savings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loans" ADD CONSTRAINT "member_loans_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loans" ADD CONSTRAINT "member_loans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loans" ADD CONSTRAINT "member_loans_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loan_installments" ADD CONSTRAINT "member_loan_installments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_loan_installments" ADD CONSTRAINT "member_loan_installments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "member_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum (additive)
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_SAVING_POSTED';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_LOAN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_INSTALLMENT_PAID';
