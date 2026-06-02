#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (!process.env.SHADOW_DATABASE_URL) {
  console.error("SHADOW_DATABASE_URL is required to verify migration history against prisma/schema.prisma.");
  process.exit(1);
}

const result = spawnSync("npx", [
  "prisma",
  "migrate",
  "diff",
  "--from-migrations",
  "prisma/migrations",
  "--to-schema-datamodel",
  "prisma/schema.prisma",
  "--shadow-database-url",
  process.env.SHADOW_DATABASE_URL,
  "--exit-code",
], { encoding: "utf8", stdio: "pipe" });

process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status === 0) {
  console.log("Prisma migrations match prisma/schema.prisma.");
  process.exit(0);
}

if (result.status === 2) {
  console.error("Prisma schema drift detected. Create a migration with `npm run prisma:migrate:dev`.");
  process.exit(1);
}

process.exit(result.status ?? 1);
