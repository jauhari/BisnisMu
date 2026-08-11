CREATE TYPE "EmployeeRole" AS ENUM ('DOCTOR', 'NURSE', 'STAFF', 'OTHER');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

CREATE TABLE "employees" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "EmployeeRole" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_runs" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "period" DATE NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "expense_account_id" TEXT NOT NULL,
  "payable_account_id" TEXT NOT NULL,
  "deduction_payable_account_id" TEXT,
  "total_gross_amount" BIGINT NOT NULL,
  "total_deduction_amount" BIGINT NOT NULL,
  "total_net_amount" BIGINT NOT NULL,
  "accrued_journal_id" TEXT,
  "payment_journal_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "approved_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_items" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "payroll_run_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "employee_name" TEXT NOT NULL,
  "employee_role" "EmployeeRole" NOT NULL,
  "salary_amount" BIGINT NOT NULL,
  "incentive_amount" BIGINT NOT NULL DEFAULT 0,
  "deduction_amount" BIGINT NOT NULL DEFAULT 0,
  "gross_amount" BIGINT NOT NULL,
  "net_amount" BIGINT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_runs_business_id_period_key" ON "payroll_runs"("business_id", "period");
CREATE INDEX "employees_business_id_is_active_idx" ON "employees"("business_id", "is_active");
CREATE INDEX "payroll_runs_business_id_status_idx" ON "payroll_runs"("business_id", "status");
CREATE UNIQUE INDEX "payroll_items_payroll_run_id_employee_id_key" ON "payroll_items"("payroll_run_id", "employee_id");
CREATE INDEX "payroll_items_business_id_employee_id_idx" ON "payroll_items"("business_id", "employee_id");

ALTER TABLE "employees" ADD CONSTRAINT "employees_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
