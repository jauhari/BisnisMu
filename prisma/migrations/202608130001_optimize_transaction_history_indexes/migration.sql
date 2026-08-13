-- Supports the tenant-scoped ordering used by the unified transaction history.
CREATE INDEX "cash_transactions_business_id_transaction_date_created_at_i_idx"
ON "cash_transactions"("business_id", "transaction_date", "created_at", "id");

CREATE INDEX "daily_sales_business_id_sale_date_created_at_id_idx"
ON "daily_sales"("business_id", "sale_date", "created_at", "id");

CREATE INDEX "sales_orders_business_id_sale_date_created_at_id_idx"
ON "sales_orders"("business_id", "sale_date", "created_at", "id");
