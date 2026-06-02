export interface ApiErrorPayload { code: string; message: string; details?: Record<string, unknown>; }
export class PresentationApiError extends Error { constructor(public readonly payload: ApiErrorPayload, public readonly status = 500) { super(payload.message); this.name = "PresentationApiError"; } }

type PresentationRequestInit = { headers?: Record<string, string>; method?: string; body?: string; credentials?: RequestCredentials };
declare const fetch: (path: string, init?: PresentationRequestInit) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown> }>;

export async function apiRequest<T>(path: string, init: PresentationRequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: init.credentials ?? "include", headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ code: "HTTP_ERROR", message: response.statusText })) as ApiErrorPayload;
    throw new PresentationApiError(payload, response.status);
  }
  return response.json() as Promise<T>;
}
