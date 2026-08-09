-- AuditAction.PRODUCT_UPDATED has been declared in schema.prisma and emitted by
-- InventoryService.updateProduct since the module was written, but no migration ever
-- added it to the enum. On a database built from migration history, updating a product
-- fails when it writes its audit row.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRODUCT_UPDATED';
