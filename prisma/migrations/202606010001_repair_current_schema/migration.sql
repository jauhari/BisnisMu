-- CreateEnum
CREATE TYPE "BusinessMemberRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER', 'VIEWER');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "active_business_id" TEXT;

-- CreateTable
CREATE TABLE "business_members" (
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
CREATE INDEX "business_members_user_id_is_active_idx" ON "business_members"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "business_members_business_id_role_idx" ON "business_members"("business_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "business_members_business_id_user_id_key" ON "business_members"("business_id", "user_id");

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

