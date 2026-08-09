-- Void/reversal support for POS transactions and sales orders, plus source-document
-- traceability on inventory movements so a void can restore the stock it consumed.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'JOURNAL_REVERSED';
ALTER TYPE "AuditAction" ADD VALUE 'SALES_ORDER_VOIDED';
ALTER TYPE "AuditAction" ADD VALUE 'INVENTORY_MOVEMENT_REVERSED';

-- AlterTable
ALTER TABLE "inventory_movements"
  ADD COLUMN "source_type" TEXT,
  ADD COLUMN "source_id" TEXT,
  ADD COLUMN "reverses_movement_id" TEXT;

-- AlterTable
ALTER TABLE "pos_transactions"
  ADD COLUMN "void_journal_ids" TEXT[],
  ADD COLUMN "void_reason" TEXT,
  ADD COLUMN "voided_by_user_id" TEXT,
  ADD COLUMN "voided_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sales_orders"
  ADD COLUMN "void_journal_ids" TEXT[],
  ADD COLUMN "void_reason" TEXT,
  ADD COLUMN "voided_by_user_id" TEXT,
  ADD COLUMN "voided_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "inventory_movements_business_id_source_type_source_id_idx"
  ON "inventory_movements"("business_id", "source_type", "source_id");
