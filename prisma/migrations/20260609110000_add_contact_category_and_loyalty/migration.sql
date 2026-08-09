-- Backfill migration for the contact category + loyalty fields.
--
-- The `ContactCategory` enum, the `contacts.category` / `pic_name` /
-- `total_visits` / `total_revenue` / `loyalty_points` columns and the
-- `(business_id, phone)` index reached existing databases through
-- `prisma db push` and were never captured as a migration, so migrating a clean
-- database left the schema behind `prisma/schema.prisma`.
--
-- Every statement is idempotent so databases that already have these objects are
-- unaffected. Keep it that way.

-- CreateEnum
DO $$
BEGIN
  IF to_regtype('"ContactCategory"') IS NULL THEN
    CREATE TYPE "ContactCategory" AS ENUM ('INDIVIDUAL', 'INSTANSI');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "category" "ContactCategory" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "pic_name" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "total_visits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "total_revenue" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "loyalty_points" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_business_id_phone_idx" ON "contacts"("business_id", "phone");
