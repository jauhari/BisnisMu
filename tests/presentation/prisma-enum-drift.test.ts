import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = "prisma/migrations";

/** Enum name -> values, as declared in prisma/schema.prisma. */
function schemaEnums(): Map<string, string[]> {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const enums = new Map<string, string[]>();

  for (const match of schema.matchAll(/^enum\s+(\w+)\s*\{([^}]*)\}/gm)) {
    const name = match[1] ?? "";
    const values = (match[2] ?? "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter((line) => /^\w+$/.test(line));
    enums.set(name, values);
  }

  return enums;
}

/** Enum name -> values reachable by replaying every migration in order. */
function migratedEnums(): Map<string, Set<string>> {
  const enums = new Map<string, Set<string>>();

  const sql = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"))
    .join("\n");

  for (const match of sql.matchAll(/CREATE\s+TYPE\s+"(\w+)"\s+AS\s+ENUM\s*\(([^)]*)\)/gi)) {
    const name = match[1] ?? "";
    const values = [...(match[2] ?? "").matchAll(/'([^']+)'/g)].map((value) => value[1] ?? "");
    enums.set(name, new Set([...(enums.get(name) ?? []), ...values]));
  }

  for (const match of sql.matchAll(/ALTER\s+TYPE\s+"(\w+)"\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']+)'/gi)) {
    const name = match[1] ?? "";
    enums.set(name, new Set([...(enums.get(name) ?? []), match[2] ?? ""]));
  }

  return enums;
}

describe("Prisma enum drift", () => {
  // A value present in schema.prisma but missing from the migrations means the
  // deployed database rejects it at runtime with
  // `invalid input value for enum`, which is how AuditAction.PRODUCT_UPDATED
  // broke every product update.
  it("creates every schema enum value in the migrations", () => {
    const migrated = migratedEnums();
    const missing: string[] = [];

    for (const [name, values] of schemaEnums()) {
      const applied = migrated.get(name);
      if (!applied) {
        missing.push(`${name} (enum type never created)`);
        continue;
      }
      for (const value of values) {
        if (!applied.has(value)) missing.push(`${name}.${value}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("parses the schema and migration enums it is asserting on", () => {
    // Guards against the regexes silently matching nothing and passing vacuously.
    const schema = schemaEnums();
    expect(schema.size).toBeGreaterThan(10);
    expect(schema.get("AuditAction")).toContain("PRODUCT_UPDATED");
    expect(migratedEnums().get("AuditAction")?.has("PRODUCT_UPDATED")).toBe(true);
  });
});
