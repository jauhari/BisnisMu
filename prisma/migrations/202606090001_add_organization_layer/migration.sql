-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('BUMDES', 'KOPERASI', 'HOLDING', 'FRANCHISE');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ORG_OWNER', 'ORG_ADMIN', 'ORG_VIEWER');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "organization_id" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'BUMDES',
    "description" TEXT,
    "address" TEXT,
    "npwp_number" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("organization_id","user_id")
);

-- CreateIndex
CREATE INDEX "organizations_created_by_id_idx" ON "organizations"("created_by_id");

-- CreateIndex
CREATE INDEX "org_members_user_id_idx" ON "org_members"("user_id");

-- CreateIndex
CREATE INDEX "businesses_organization_id_idx" ON "businesses"("organization_id");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
