import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Every repository is written against this type rather than `PrismaClient` so the same
 * instance can be constructed either on the pooled client or on a transaction handle.
 * That is what lets a whole multi-step operation — post a journal, move stock, update a
 * document — commit or roll back as one unit.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

function ownsTransaction(db: DbClient): db is PrismaClient {
  return "$transaction" in db;
}

/**
 * Runs `fn` inside a transaction. When `db` is already a transaction handle the work
 * joins that transaction instead of opening a nested one (PostgreSQL has no true nested
 * transactions, and Prisma forbids `$transaction` on a transaction client).
 */
export async function withTransaction<T>(
  db: DbClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number }
): Promise<T> {
  if (ownsTransaction(db)) return db.$transaction(fn, options);
  return fn(db);
}

/** True when the caller is already inside a transaction opened further up the stack. */
export function isInTransaction(db: DbClient): boolean {
  return !ownsTransaction(db);
}

/**
 * Transient failures worth re-running the whole unit of work for: a unique-constraint
 * race on a generated document number, a serialization failure, or a deadlock victim.
 */
export function isRetryablePostgresError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return true;
  if (!(error instanceof Error)) return false;
  return error.message.includes("could not serialize")
    || error.message.includes("deadlock")
    || error.message.includes("Transaction already closed");
}
