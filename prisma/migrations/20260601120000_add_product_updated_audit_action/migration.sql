-- AlterEnum
-- `AuditAction.PRODUCT_UPDATED` was added to prisma/schema.prisma without a
-- matching migration, so the database enum was missing the value and every
-- product update (InventoryService.updateProduct -> audit "PRODUCT_UPDATED")
-- failed with `invalid input value for enum "AuditAction"`.
-- Inserted after PRODUCT_CREATED to keep the database order aligned with the schema.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRODUCT_UPDATED' AFTER 'PRODUCT_CREATED';
