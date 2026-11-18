#!/usr/bin/env node
/**
 * Bandingkan jumlah baris semua tabel antara dua database.
 * Pemakaian: node scripts/compare-db-rows.mjs <oldUrl> <newUrl>
 */
import { execFileSync } from "node:child_process";

const [oldUrl, newUrl] = process.argv.slice(2);
if (!oldUrl || !newUrl) {
  console.error("Pemakaian: node scripts/compare-db-rows.mjs <oldUrl> <newUrl>");
  process.exit(1);
}

const PSQL = "/opt/homebrew/opt/libpq/bin/psql";

const SQL = `
select table_name || E'\\t' || coalesce((
  xpath('/row/cnt/text()',
    query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '')
  ))[1]::text, '0')
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
`;

function counts(url) {
  const out = execFileSync(PSQL, [url, "-tAc", SQL], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const map = new Map();
  for (const line of out.split("\n")) {
    const [name, value] = line.split("\t");
    if (name) map.set(name.trim(), Number(value));
  }
  return map;
}

const before = counts(oldUrl);
const after = counts(newUrl);

const missing = [...before.keys()].filter((table) => !after.has(table));
const extra = [...after.keys()].filter((table) => !before.has(table));
const mismatched = [...before.entries()].filter(([table, value]) => after.has(table) && after.get(table) !== value);

const totalRows = [...before.values()].reduce((sum, n) => sum + n, 0);

console.log(`tabel di lama : ${before.size}`);
console.log(`tabel di baru : ${after.size}`);
console.log(`total baris   : ${totalRows.toLocaleString("id-ID")}`);
console.log("");

if (missing.length) console.log("HILANG di DB baru:", missing.join(", "));
if (extra.length) console.log("EKSTRA di DB baru:", extra.join(", "));
if (mismatched.length) {
  console.log("JUMLAH BARIS BERBEDA:");
  for (const [table, value] of mismatched) console.log(`  ${table}: lama=${value} baru=${after.get(table)}`);
}

if (!missing.length && !extra.length && !mismatched.length) {
  console.log(`✓ SEMUA ${before.size} TABEL COCOK (${totalRows.toLocaleString("id-ID")} baris)`);
} else {
  process.exitCode = 1;
}
