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

// Entity IDs are opaque. This previously accepted only Prisma cuid() v1 and
// UUIDs, which rejected legitimate IDs in any other shape (cuid2, nanoid, ULID,
// imported records) with a confusing "Invalid request body" — switching to a
// business the user actually owns failed that way. Keep this a sanity check on
// the shape only: authorization comes from resolving the ID against a
// tenant-scoped query, never from the ID looking a particular way.
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
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
