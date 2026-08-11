-- Backfill migration for the daily sales tables.
--
-- `daily_sales`, `daily_sale_items` and `daily_sale_contacts` reached existing
-- databases through `prisma db push` and were never captured as a migration, so
-- `prisma migrate deploy` on a clean database failed at
-- `20260610120000_add_daily_sale_void_status` with
-- `ERROR: relation "daily_sales" does not exist`.
--
-- The columns that `20260610120000_add_daily_sale_void_status` adds (status,
-- void_journal_id, void_reason, voided_by_user_id, voided_at, updated_at) are
-- deliberately NOT created here — that later migration still owns them.
--
-- Every statement is idempotent so databases that already have these tables are
-- unaffected. Keep it that way.

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_sales" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "sale_date" DATE NOT NULL,
    "cash_account_id" TEXT NOT NULL,
    "description" TEXT,
    "total_amount" BIGINT NOT NULL DEFAULT 0,
    "journal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_sale_items" (
    "id" TEXT NOT NULL,
    "daily_sale_id" TEXT NOT NULL,
    "revenue_account_id" TEXT NOT NULL,
    "description" TEXT,
    "amount" BIGINT NOT NULL,
    "line_no" INTEGER NOT NULL,

    CONSTRAINT "daily_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_sale_contacts" (
    "id" TEXT NOT NULL,
    "daily_sale_item_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "amount" BIGINT,
    "notes" TEXT,

    CONSTRAINT "daily_sale_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_sales_business_id_sale_date_idx" ON "daily_sales"("business_id", "sale_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_sale_items_daily_sale_id_idx" ON "daily_sale_items"("daily_sale_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "daily_sale_contacts_contact_id_idx" ON "daily_sale_contacts"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_sale_contacts_daily_sale_item_id_contact_id_key" ON "daily_sale_contacts"("daily_sale_item_id", "contact_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_sales_business_id_fkey' AND conrelid = '"daily_sales"'::regclass) THEN
    ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_sales_cash_account_id_fkey' AND conrelid = '"daily_sales"'::regclass) THEN
    ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_sales_created_by_user_id_fkey' AND conrelid = '"daily_sales"'::regclass) THEN
    ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_sale_items_daily_sale_id_fkey' AND conrelid = '"daily_sale_items"'::regclass) THEN
    ALTER TABLE "daily_sale_items" ADD CONSTRAINT "daily_sale_items_daily_sale_id_fkey" FOREIGN KEY ("daily_sale_id") REFERENCES "daily_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_sale_items_revenue_account_id_fkey' AND conrelid = '"daily_sale_items"'::regclass) THEN
    ALTER TABLE "daily_sale_items" ADD CONSTRAINT "daily_sale_items_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_sale_contacts_daily_sale_item_id_fkey' AND conrelid = '"daily_sale_contacts"'::regclass) THEN
    ALTER TABLE "daily_sale_contacts" ADD CONSTRAINT "daily_sale_contacts_daily_sale_item_id_fkey" FOREIGN KEY ("daily_sale_item_id") REFERENCES "daily_sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_sale_contacts_contact_id_fkey' AND conrelid = '"daily_sale_contacts"'::regclass) THEN
    ALTER TABLE "daily_sale_contacts" ADD CONSTRAINT "daily_sale_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
