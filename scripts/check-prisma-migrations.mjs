#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["prisma", "migrate", "status", "--schema", "prisma/schema.prisma"], {
  encoding: "utf8",
  stdio: "pipe",
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status !== 0) {
  console.error("Prisma migration status check failed. Apply pending migrations with `npm run prisma:migrate:deploy` before starting the app.");
  process.exit(result.status ?? 1);
}

if (/following migration\(s\) have not yet been applied|Database schema is not up to date|have not yet been applied/i.test(output)) {
  console.error("Pending Prisma migrations detected. Apply them with `npm run prisma:migrate:deploy` before starting the app.");
  process.exit(1);
}
