import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Prisma migration hardening", () => {
  it("exposes migrate dev and deploy scripts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts["prisma:migrate:dev"]).toBe("prisma migrate dev --schema prisma/schema.prisma");
    expect(pkg.scripts["prisma:migrate:deploy"]).toBe("prisma migrate deploy --schema prisma/schema.prisma");
    expect(pkg.scripts["prisma:migrations:check"]).toBe("node scripts/check-prisma-migrations.mjs");
    expect(pkg.scripts.start).toContain("prisma:migrations:check");
  });

  it("keeps a PostgreSQL migration lock file", () => {
    const lock = readFileSync("prisma/migrations/migration_lock.toml", "utf8");
    expect(lock).toContain('provider = "postgresql"');
  });

  it("startup guard fails on pending migrations", () => {
    const guard = readFileSync("scripts/check-prisma-migrations.mjs", "utf8");
    expect(guard).toContain("prisma");
    expect(guard).toContain("migrate");
    expect(guard).toContain("status");
    expect(guard).toContain("Pending Prisma migrations detected");
    expect(guard).toContain("process.exit(1)");
    expect(guard).toContain('node_modules/prisma/build/index.js');
    expect(guard).toContain("process.execPath");
  });

  it("migration verifier requires a shadow database", () => {
    const verifier = readFileSync("scripts/verify-prisma-migrations.mjs", "utf8");
    expect(verifier).toContain("SHADOW_DATABASE_URL");
    expect(verifier).toContain("--from-migrations");
    expect(verifier).toContain("--to-schema-datamodel");
    expect(verifier).toContain("--exit-code");
    expect(verifier).toContain('node_modules/prisma/build/index.js');
    expect(verifier).toContain("process.execPath");
  });

  it("uses Neon pooler for routine Prisma traffic and direct URL for atomic writes", () => {
    const client = readFileSync("src/presentation/api/prisma.ts", "utf8");
    expect(client).toContain("const pooledDatabaseUrl = addConnectionOptions(process.env.DATABASE_URL)");
    expect(client).toContain("const directDatabaseUrl = addConnectionOptions(process.env.DIRECT_URL ?? process.env.DATABASE_URL)");
    expect(client).toContain("url: pooledDatabaseUrl");
    expect(client).toContain("url: directDatabaseUrl");
  });
});
