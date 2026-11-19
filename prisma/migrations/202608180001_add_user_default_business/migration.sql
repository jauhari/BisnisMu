-- AlterTable
ALTER TABLE "users" ADD COLUMN "default_business_id" TEXT;

-- CreateIndex
CREATE INDEX "users_default_business_id_idx" ON "users"("default_business_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_business_id_fkey" FOREIGN KEY ("default_business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
