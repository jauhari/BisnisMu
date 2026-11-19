/**
 * Opaque transaction-client handle threaded from the application layer into
 * repositories so a single business operation (journal + domain record +
 * balances) commits atomically. Typed as `unknown` here to keep domain/port
 * code free of a hard Prisma dependency; Prisma adapters cast it to
 * `Prisma.TransactionClient`. In-memory test repositories simply ignore it.
 */
export type TxClient = unknown;
