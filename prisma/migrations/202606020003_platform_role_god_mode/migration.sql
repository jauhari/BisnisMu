-- Platform role enum and column on users
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_ADMIN', 'DEVELOPER');

ALTER TABLE "users" ADD COLUMN "platform_role" "PlatformRole" NOT NULL DEFAULT 'USER';

-- God mode audit log
CREATE TABLE "god_mode_audit_logs" (
    "id"          TEXT NOT NULL,
    "actor_id"    TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id"   TEXT,
    "detail"      JSONB,
    "ip_address"  TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "god_mode_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "god_mode_audit_logs_actor_id_idx" ON "god_mode_audit_logs"("actor_id");
CREATE INDEX "god_mode_audit_logs_created_at_idx" ON "god_mode_audit_logs"("created_at");

ALTER TABLE "god_mode_audit_logs"
    ADD CONSTRAINT "god_mode_audit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
