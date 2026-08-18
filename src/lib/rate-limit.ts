import { redis } from "@/lib/queue";

/**
 * Fixed-window rate limiter on top of the shared Redis connection (same one
 * BullMQ already uses — no new infrastructure). Deliberately fail-open: if
 * Redis is unreachable, the request is allowed through rather than blocked,
 * because an outage in the rate limiter must never become an outage of the
 * feature it's protecting (same philosophy as notifyEvent's fan-out queue).
 *
 * Covers three previously-unprotected surfaces (checklist items i5/i6/i7):
 * login attempts, the public quick-confirm link, and AI calls.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets, for a Retry-After header. */
  resetInSeconds: number;
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    const ttl = await redis.ttl(redisKey);
    const resetInSeconds = ttl > 0 ? ttl : windowSeconds;

    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetInSeconds };
  } catch (err) {
    console.error("[rate-limit] Redis unavailable, failing open:", err);
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}

/** Best-effort client identifier for unauthenticated/public routes — not spoof-proof, but raises the bar past "none at all". */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Shared limit for every route that calls the AI provider (Q&A + all five
 * Suggest Mode actions) — one place to tune, instead of a magic number
 * copy-pasted into six route files. 30/hour is generous for real usage
 * (drafting, gap analysis, Q&A) while bounding a single account's worst-case
 * Gemini cost if a script or a compromised session hammers the endpoint.
 */
export async function checkAiRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`ai:${userId}`, 30, 3600);
}
