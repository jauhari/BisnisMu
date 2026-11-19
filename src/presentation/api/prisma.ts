import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaDirect?: PrismaClient };

function addConnectionOptions(url: string | undefined): string | undefined {
  if (!url) return url;
  const additions = [
    ...(url.includes("connection_limit=") ? [] : ["connection_limit=3"]),
    ...(url.includes("pool_timeout=") ? [] : ["pool_timeout=20"]),
  ];
  return additions.length ? `${url}${url.includes("?") ? "&" : "?"}${additions.join("&")}` : url;
}

// API reads and lightweight writes use Neon PgBouncer. Keeping this client on
// DATABASE_URL prevents local production runtime requests from bypassing the
// reachable pooler endpoint. Multi-write atomic operations use the direct URL.
const pooledDatabaseUrl = addConnectionOptions(process.env.DATABASE_URL);
const directDatabaseUrl = addConnectionOptions(process.env.DIRECT_URL ?? process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(pooledDatabaseUrl ? { datasources: { db: { url: pooledDatabaseUrl } } } : {}),
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
 * + balance updates). It uses DIRECT_URL, falling back to DATABASE_URL only
 * when a direct endpoint was not configured.
 */
export const prismaDirect =
  globalForPrisma.prismaDirect ??
  new PrismaClient({
    ...(directDatabaseUrl ? { datasources: { db: { url: directDatabaseUrl } } } : {}),
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaDirect = prismaDirect;
