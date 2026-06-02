import { z, type ZodTypeAny } from "zod";

import { requireTenantContext } from "@/presentation/auth/session";

export class ValidationError extends Error {
  readonly fields: Record<string, string[]>;

  constructor(fields: Record<string, string[]>) {
    super("Invalid request body");
    this.name = "ValidationError";
    this.fields = fields;
  }
}

// IDs in this app are Prisma cuid()s, not UUIDs. Accept cuid or uuid so route
// validation doesn't reject valid entity IDs (e.g. customerId, accountId).
const ID_PATTERN = /^(c[a-z0-9]{20,}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
export const uuidSchema = z.string().regex(ID_PATTERN, "Invalid id");
export const dateSchema = z.coerce.date().refine((value) => !Number.isNaN(value.getTime()), "Invalid date");
export const bigintSchema = z.union([z.string(), z.number(), z.bigint()]).pipe(z.coerce.bigint());
export const positiveQuantitySchema = bigintSchema.refine((value) => value > 0n, "Quantity must be greater than 0");
export const nonNegativeMoneySchema = bigintSchema.refine((value) => value >= 0n, "Amount must be greater than or equal to 0");
export const positiveMoneySchema = bigintSchema.refine((value) => value > 0n, "Amount must be greater than 0");
export const optionalUuidSchema = uuidSchema.optional();

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    fields[path] = [...(fields[path] ?? []), issue.message];
  }
  return fields;
}

export async function parseAndValidate<TSchema extends ZodTypeAny>(request: Request, schema: TSchema): Promise<z.output<TSchema>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ValidationError({ body: ["Expected valid JSON body"] });
  }

  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(fieldErrors(result.error));
  return result.data;
}

export async function validatedBody<TSchema extends ZodTypeAny>(request: Request, schema: TSchema): Promise<z.output<TSchema> & { businessId: string; actorUserId: string }> {
  const [body, tenant] = await Promise.all([parseAndValidate(request, schema), requireTenantContext(request)]);
  return { ...body, businessId: tenant.businessId, actorUserId: tenant.actorUserId };
}
