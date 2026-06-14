function buildCsp(nonce?: string): string {
  // Next.js dev mode (HMR / React Refresh) requires 'unsafe-eval'; production
  // does not, so we only drop it outside development — a real XSS hardening in
  // prod without breaking local dev.
  const allowEval = process.env.NODE_ENV !== "production";
  // Scripts: when a nonce is available (middleware path), inline scripts must
  // carry it and 'strict-dynamic' lets nonce'd scripts load dependencies.
  // The static-header path (next.config) keeps 'unsafe-inline' as a fallback
  // because no per-request nonce exists there.
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${allowEval ? " 'unsafe-eval'" : ""}`
    : `script-src 'self' 'unsafe-inline'${allowEval ? " 'unsafe-eval'" : ""}`;
  return [
    "default-src 'self'",
    scriptSrc,
    // Tailwind/React still require inline styles; keep 'unsafe-inline' for styles only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export const contentSecurityPolicy = buildCsp();

export function contentSecurityPolicyWithNonce(nonce: string): string {
  return buildCsp(nonce);
}

export const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
] as const;

export function applySecurityHeaders(headers: Headers): Headers {
  for (const header of securityHeaders) headers.set(header.key, header.value);
  return headers;
}

export function withSecurityHeaders(response: Response): Response {
  applySecurityHeaders(response.headers);
  return response;
}
