-- Add PRODUCT_UPDATED to the AuditAction enum so product edits can be audited.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRODUCT_UPDATED';
