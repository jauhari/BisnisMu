export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

export interface RateLimiter {
  limit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now();
    const bucketKey = `${rule.name}:${key}`;
    const existing = this.buckets.get(bucketKey);
    const resetAt = existing && existing.resetAt > now ? existing.resetAt : now + rule.windowSeconds * 1000;
    const count = existing && existing.resetAt > now ? existing.count + 1 : 1;
    this.buckets.set(bucketKey, { count, resetAt });

    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      success: count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt,
      retryAfter,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

export class UpstashRedisRateLimiter implements RateLimiter {
  constructor(private readonly url: string, private readonly token: string) {}

  async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = `${rule.name}:${key}:${Math.floor(now / (rule.windowSeconds * 1000))}`;
    const endpoint = this.url.replace(/\/$/, "");
    const response = await fetch(`${endpoint}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", bucket],
        ["EXPIRE", bucket, String(rule.windowSeconds)],
      ]),
    });
    if (!response.ok) throw new Error("Rate limiter unavailable");

    const data = await response.json() as Array<{ result?: number }>;
    const count = Number(data[0]?.result ?? 1);
    const resetAt = (Math.floor(now / (rule.windowSeconds * 1000)) + 1) * rule.windowSeconds * 1000;
    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      success: count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt,
      retryAfter,
    };
  }
}

const globalForRateLimit = globalThis as unknown as { memoryRateLimiter?: MemoryRateLimiter; rateLimiter: RateLimiter | undefined };

export const AUTH_LOGIN_LIMIT: RateLimitRule = { name: "auth:login", limit: 5, windowSeconds: 60 };
export const AUTH_REGISTER_LIMIT: RateLimitRule = { name: "auth:register", limit: 3, windowSeconds: 60 };
export const API_WRITE_LIMIT: RateLimitRule = { name: "api:write", limit: 100, windowSeconds: 60 };
export const API_READ_LIMIT: RateLimitRule = { name: "api:read", limit: 300, windowSeconds: 60 };
export const REPORT_LIMIT: RateLimitRule = { name: "api:reports", limit: 30, windowSeconds: 60 };
export const POS_CHECKOUT_LIMIT: RateLimitRule = { name: "api:pos-checkout", limit: 60, windowSeconds: 60 };

export function createRateLimiter(): RateLimiter {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) return new UpstashRedisRateLimiter(upstashUrl, upstashToken);
  globalForRateLimit.memoryRateLimiter ??= new MemoryRateLimiter();
  return globalForRateLimit.memoryRateLimiter;
}

export function getRateLimiter(): RateLimiter {
  globalForRateLimit.rateLimiter ??= createRateLimiter();
  return globalForRateLimit.rateLimiter;
}

export function setRateLimiterForTests(rateLimiter: RateLimiter | undefined): void {
  globalForRateLimit.rateLimiter = rateLimiter;
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: "RATE_LIMIT_EXCEEDED" },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfter),
        "x-ratelimit-limit": String(result.limit),
        "x-ratelimit-remaining": String(result.remaining),
        "x-ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

export function authRateLimitRule(pathname: string): RateLimitRule | null {
  if (pathname.includes("sign-in") || pathname.includes("login")) return AUTH_LOGIN_LIMIT;
  if (pathname.includes("sign-up") || pathname.includes("register")) return AUTH_REGISTER_LIMIT;
  return null;
}

export function apiRateLimitRule(pathname: string, method: string): RateLimitRule {
  if (pathname.startsWith("/api/reports/")) return REPORT_LIMIT;
  if (pathname === "/api/pos/checkout" && method.toUpperCase() !== "GET") return POS_CHECKOUT_LIMIT;
  return method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD" ? API_READ_LIMIT : API_WRITE_LIMIT;
}
