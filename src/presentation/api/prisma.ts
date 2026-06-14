import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaDirect?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
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
 * Direct (unpooled) client routed through DIRECT_URL. PgBouncer transaction
 * pooling cannot serve Prisma interactive transactions, so multi-write atomic
 * operations (journal + domain record + balance updates) must run here.
 * Falls back to the pooled client's connection when DIRECT_URL is unset
 * (e.g. local Postgres that is not behind a pooler).
 */
export const prismaDirect =
  globalForPrisma.prismaDirect ??
  (process.env.DIRECT_URL
    ? new PrismaClient({
        datasources: { db: { url: process.env.DIRECT_URL } },
        transactionOptions: { maxWait: 10_000, timeout: 30_000 },
      })
    : prisma);

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaDirect = prismaDirect;
