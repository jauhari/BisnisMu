import type { PrismaClient } from "@prisma/client";

import type { TransactionRunner } from "../../features/shared/transaction-runner";
import type { TxClient } from "../../features/shared/tx";
import { prismaDirect } from "./prisma";

/**
 * Runs a unit of work inside a Prisma interactive transaction on the direct
 * (unpooled) connection. PgBouncer transaction pooling cannot serve interactive
 * transactions, so atomic multi-write operations must use `prismaDirect`.
 */
export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly client: PrismaClient = prismaDirect) {}

  run<T>(work: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx) => work(tx), { timeout: 30_000 });
  }
}

export const prismaTransactionRunner = new PrismaTransactionRunner();
