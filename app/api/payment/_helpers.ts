import { z } from "zod";

import { requireTenantContext } from "@/presentation/auth/session";
import { dateSchema, nonNegativeMoneySchema, parseAndValidate, positiveMoneySchema, uuidSchema } from "@/presentation/api/validation";

const paymentSchema = z.object({
  transactionDate: dateSchema.optional(),
  settlementDate: dateSchema.optional(),
  amount: positiveMoneySchema.optional(),
  allocationAmount: positiveMoneySchema.optional(),
  adjustmentAmount: nonNegativeMoneySchema.optional(),
  walletId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  receivableId: uuidSchema.optional(),
  paymentId: uuidSchema.optional(),
}).passthrough();

export async function apiContext(request: Request): Promise<{ businessId: string; actorUserId: string }> {
  const tenant = await requireTenantContext(request);
  return { businessId: tenant.businessId, actorUserId: tenant.actorUserId };
}

export async function paymentBody(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET" || request.method === "HEAD") {
    const url = new URL(request.url);
    return Object.fromEntries(url.searchParams.entries());
  }
  return parseAndValidate(request, paymentSchema) as Promise<Record<string, unknown>>;
}

export async function paymentCommand(request: Request): Promise<Record<string, unknown> & { businessId: string; actorUserId: string }> {
  const [context, body] = await Promise.all([apiContext(request), paymentBody(request)]);
  return { ...body, ...context };
}

export function coerceDates(body: Record<string, unknown>): Record<string, unknown> { return body; }
