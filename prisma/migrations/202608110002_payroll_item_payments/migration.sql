CREATE TYPE "PayrollItemPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

ALTER TABLE "payroll_items"
  ADD COLUMN "paid_amount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "payment_status" "PayrollItemPaymentStatus" NOT NULL DEFAULT 'UNPAID';

CREATE TABLE "payroll_payments" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "payroll_run_id" TEXT NOT NULL,
  "payroll_item_id" TEXT NOT NULL,
  "payment_account_id" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "paid_at" DATE NOT NULL,
  "journal_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_payments_business_id_payroll_run_id_idx" ON "payroll_payments"("business_id", "payroll_run_id");
CREATE INDEX "payroll_payments_payroll_item_id_paid_at_idx" ON "payroll_payments"("payroll_item_id", "paid_at");

ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payroll_item_id_fkey" FOREIGN KEY ("payroll_item_id") REFERENCES "payroll_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
