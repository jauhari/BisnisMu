#!/usr/bin/env node
/**
 * Bench TTFB beberapa route penting. Dipakai untuk membandingkan sebelum/sesudah
 * optimasi secara objektif (median dari beberapa sampel).
 *
 * Pakai:
 *   node scripts/bench-routes.mjs <baseUrl> <sessionToken> [samples]
 */
const baseUrl = (process.argv[2] || "https://www.bisnismu.net").replace(/\/$/, "");
const token = process.argv[3];
const samples = Number(process.argv[4] || 3);

if (!token) {
  console.error("Butuh session token. Pakai: node scripts/bench-routes.mjs <baseUrl> <token> [samples]");
  process.exit(1);
}

const targets = [
  { label: "doc /login", path: "/login", auth: false },
  { label: "doc /dashboard", path: "/dashboard" },
  { label: "doc /accounting/journals", path: "/accounting/journals" },
  { label: "api /health", path: "/api/health", auth: false },
  { label: "api /auth/me", path: "/api/auth/me" },
  { label: "api /auth/businesses", path: "/api/auth/businesses" },
  { label: "api /dashboard/overview", path: "/api/dashboard/overview" },
  { label: "api /accounting/chart-of-accounts", path: "/api/accounting/chart-of-accounts" },
  { label: "api /members", path: "/api/members" },
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const rows = [];

for (const target of targets) {
  const timings = [];
  let status = 0;
  let bytes = 0;

  for (let i = 0; i < samples; i += 1) {
    const headers = target.auth === false ? {} : { Cookie: `better-auth.session_token=${token}` };
    const started = process.hrtime.bigint();
    try {
      const res = await fetch(`${baseUrl}${target.path}`, { headers, redirect: "manual" });
      await res.arrayBuffer();
      const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
      timings.push(elapsed);
      status = res.status;
      bytes = Number(res.headers.get("content-length") || 0);
    } catch (error) {
      timings.push(Number.NaN);
      status = -1;
    }
  }

  const valid = timings.filter((value) => Number.isFinite(value));
  rows.push({
    route: target.label,
    status,
    median: valid.length ? Math.round(median(valid)) : null,
    min: valid.length ? Math.round(Math.min(...valid)) : null,
    max: valid.length ? Math.round(Math.max(...valid)) : null,
    bytes,
  });
}

console.log(`\nBase: ${baseUrl}   samples: ${samples}\n`);
console.log("route".padEnd(38) + "status".padStart(7) + "median".padStart(9) + "min".padStart(7) + "max".padStart(7));
console.log("-".repeat(68));
for (const row of rows) {
  console.log(
    row.route.padEnd(38) +
      String(row.status).padStart(7) +
      `${row.median ?? "-"}ms`.padStart(9) +
      `${row.min ?? "-"}ms`.padStart(7) +
      `${row.max ?? "-"}ms`.padStart(7),
  );
}
console.log();
