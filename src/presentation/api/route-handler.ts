import { ok, problem } from "./envelope";
import { ValidationError } from "./validation";
import { isAuthError } from "@/presentation/auth/auth-error";

/** Recursively converts BigInt values to strings for JSON serialization. */
function serializeResponse(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeResponse);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeResponse(v);
    }
    return out;
  }
  return value;
}

export async function handleApi<T>(work: () => Promise<T>, requestId?: string): Promise<Response> {
  try {
    const result = await work();
    const envelope = ok(result, requestId);
    return Response.json(serializeResponse(envelope), { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ code: "BAD_REQUEST", message: error.message, fields: error.fields }, { status: 400 });
    }
    if (isAuthError(error)) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status });
    }
    return Response.json(problem(error), { status: 400 });
  }
}

export function parseJsonBody<T>(body: unknown): T { return body as T; }
