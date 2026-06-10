-- Installment (cicilan) plans & schedules
CREATE TYPE "InstallmentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "InstallmentScheduleStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

CREATE TABLE "installment_plans" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "plan_number" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "sales_order_id" TEXT,
  "description" TEXT NOT NULL,
  "total_amount" BIGINT NOT NULL,
  "down_payment" BIGINT NOT NULL DEFAULT 0,
  "financed_amount" BIGINT NOT NULL,
  "tenor" INTEGER NOT NULL,
  "start_date" DATE NOT NULL,
  "ar_account_id" TEXT NOT NULL,
  "status" "InstallmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "installment_plans_business_id_plan_number_key" ON "installment_plans"("business_id", "plan_number");
CREATE INDEX "installment_plans_business_id_customer_id_idx" ON "installment_plans"("business_id", "customer_id");
CREATE INDEX "installment_plans_business_id_status_idx" ON "installment_plans"("business_id", "status");

CREATE TABLE "installment_schedules" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "due_date" DATE NOT NULL,
  "amount" BIGINT NOT NULL,
  "paid_amount" BIGINT NOT NULL DEFAULT 0,
  "status" "InstallmentScheduleStatus" NOT NULL DEFAULT 'UNPAID',
  "paid_at" TIMESTAMP(3),
  "posted_journal_id" TEXT,
  CONSTRAINT "installment_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "installment_schedules_business_id_plan_id_sequence_key" ON "installment_schedules"("business_id", "plan_id", "sequence");
CREATE INDEX "installment_schedules_business_id_plan_id_idx" ON "installment_schedules"("business_id", "plan_id");
ALTER TABLE "installment_schedules" ADD CONSTRAINT "installment_schedules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "installment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
