UPDATE "organizations"
SET "settings" = COALESCE("settings", '{}'::jsonb) || '{"transactionHardMutationEnabled": true}'::jsonb
WHERE lower("name") LIKE '%hanyukupi%';
