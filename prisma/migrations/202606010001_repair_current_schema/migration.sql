-- Repair migration.
--
-- Every object below is also created by `20260531150000_auth_business_member`.
-- This migration exists for databases that were provisioned with the old
-- `prisma db push` workflow and then had the baseline migration marked as
-- applied without it actually running, leaving these objects missing.
--
-- On a database where the baseline migration really ran, all of these already
-- exist, so each statement must be a no-op instead of an error. Keep every
-- statement in this file idempotent.

-- CreateEnum
DO $$
BEGIN
  IF to_regtype('"BusinessMemberRole"') IS NULL THEN
    CREATE TYPE "BusinessMemberRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER', 'VIEWER');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "active_business_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "business_members" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "BusinessMemberRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_members_user_id_is_active_idx" ON "business_members"("user_id", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_members_business_id_role_idx" ON "business_members"("business_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_members_business_id_user_id_key" ON "business_members"("business_id", "user_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_members_business_id_fkey'
      AND conrelid = '"business_members"'::regclass
  ) THEN
    ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_members_user_id_fkey'
      AND conrelid = '"business_members"'::regclass
  ) THEN
    ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
