ALTER TABLE "daily_sales"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'POSTED',
  ADD COLUMN "void_journal_id" TEXT,
  ADD COLUMN "void_reason" TEXT,
  ADD COLUMN "voided_by_user_id" TEXT,
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "daily_sales_business_id_status_idx" ON "daily_sales"("business_id", "status");
