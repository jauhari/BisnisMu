import { isDomainError } from "@/features/shared/domain/domain-error";
import type { ApiEnvelope, ApiProblem } from "./contracts";

export function ok<T>(data: T, requestId?: string): ApiEnvelope<T> {
  const meta: ApiEnvelope<T>["meta"] = { generatedAt: new Date().toISOString() };
  if (requestId !== undefined) meta.requestId = requestId;
  return { data, meta };
}

/**
 * Maps a thrown value onto the wire.
 *
 * Only a DomainError carries a message meant for the caller. Anything else is a defect
 * or an infrastructure failure, and its message can contain connection strings, SQL
 * fragments or file paths -- so it is logged here and reported generically. The status
 * separation matters as much as the message: returning 400 for a database outage tells
 * monitoring the client sent a bad request.
 */
export function problem(error: unknown): { status: number; body: ApiProblem } {
  if (isDomainError(error)) {
    const body: ApiProblem = { code: error.code, message: error.message };
    if (error.details !== undefined) body.details = error.details;
    return { status: 400, body };
  }

  console.error("[api] unhandled error", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error);
  return { status: 500, body: { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Please try again." } };
}
