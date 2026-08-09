/**
 * Base class for every business-rule failure raised by a feature module.
 *
 * The distinction matters at the HTTP boundary: a DomainError is an expected outcome
 * with a message written to be read by the caller ("Only draft sales can be confirmed"),
 * so it is safe to return as-is. Anything else reaching the boundary is a defect or an
 * infrastructure failure whose message may carry connection strings, SQL, or file paths,
 * and must be logged server-side and reported generically.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
