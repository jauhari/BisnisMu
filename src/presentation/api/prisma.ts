import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaDirect?: PrismaClient };

function directDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace("-pooler.", ".");
}

function addConnectionOptions(url: string | undefined): string | undefined {
  if (!url) return url;
  const additions = [
    ...(url.includes("connection_limit=") ? [] : ["connection_limit=3"]),
    ...(url.includes("pool_timeout=") ? [] : ["pool_timeout=20"]),
  ];
  return additions.length ? `${url}${url.includes("?") ? "&" : "?"}${additions.join("&")}` : url;
}

// Neon exposes a PgBouncer endpoint with `-pooler` in the hostname. It is
// useful for high-concurrency API traffic, but long-lived local Next.js
// server-rendered requests can retain a stale pooled socket after idle time.
// Prefer the explicit direct URL when supplied; otherwise derive it safely
// from DATABASE_URL so local development remains reliable with one env var.
const configuredDatabaseUrl = addConnectionOptions(directDatabaseUrl(process.env.DIRECT_URL ?? process.env.DATABASE_URL));

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(configuredDatabaseUrl ? { datasources: { db: { url: configuredDatabaseUrl } } } : {}),
    // DB Neon (remote, via PgBouncer) menambah latency tiap query, sehingga
    // default interactive-transaction timeout Prisma (5000ms) sering kurang
    // untuk transaksi multi-write. Naikkan batas default secara global agar
    // semua $transaction punya headroom yang sama.
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Dedicated client for multi-write atomic operations (journal + domain record
 * + balance updates). It uses the same direct connection as the default client
 * when DIRECT_URL is not explicitly configured.
 */
export const prismaDirect =
  globalForPrisma.prismaDirect ??
  new PrismaClient({
    ...(configuredDatabaseUrl ? { datasources: { db: { url: configuredDatabaseUrl } } } : {}),
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaDirect = prismaDirect;
