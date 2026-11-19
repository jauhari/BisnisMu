import type { TxClient } from "./tx";

/**
 * Runs a unit of work atomically. The production implementation is backed by
 * Prisma's interactive `$transaction` on the direct (unpooled) connection; the
 * default no-op runner executes the work inline with no transaction client,
 * which keeps in-memory test repositories and non-DB callers working unchanged.
 */
export interface TransactionRunner {
  run<T>(work: (tx: TxClient) => Promise<T>): Promise<T>;
}

/** Inline runner: no real transaction. Used by tests and as a safe default. */
export const inlineTransactionRunner: TransactionRunner = {
  run: (work) => work(undefined),
};
