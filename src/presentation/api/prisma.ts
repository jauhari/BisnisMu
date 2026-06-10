import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

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
