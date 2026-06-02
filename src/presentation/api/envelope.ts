import type { ApiEnvelope, ApiProblem } from "./contracts";

export function ok<T>(data: T, requestId?: string): ApiEnvelope<T> {
  const meta: ApiEnvelope<T>["meta"] = { generatedAt: new Date().toISOString() };
  if (requestId !== undefined) meta.requestId = requestId;
  return { data, meta };
}
export function problem(error: unknown): ApiProblem { if (error instanceof Error) return { code: "DOMAIN_ERROR", message: error.message }; return { code: "UNKNOWN_ERROR", message: "Unknown error" }; }
