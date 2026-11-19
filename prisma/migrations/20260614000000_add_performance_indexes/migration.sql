-- Performance indexes for hot reporting/dashboard query paths (audit H-9).
-- Names follow Prisma's @@index convention: "<table>_<col1>_<col2>_idx".

CREATE INDEX IF NOT EXISTS "accounts_business_id_subtype_idx" ON "accounts"("business_id", "subtype");

CREATE INDEX IF NOT EXISTS "journal_entries_business_id_status_transaction_date_idx" ON "journal_entries"("business_id", "status", "transaction_date");

CREATE INDEX IF NOT EXISTS "invoices_business_id_issue_date_idx" ON "invoices"("business_id", "issue_date");

CREATE INDEX IF NOT EXISTS "bills_business_id_issue_date_idx" ON "bills"("business_id", "issue_date");

CREATE INDEX IF NOT EXISTS "inventory_movements_business_id_movement_date_idx" ON "inventory_movements"("business_id", "movement_date");
