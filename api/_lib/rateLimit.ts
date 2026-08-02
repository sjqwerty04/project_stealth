/**
 * Per-caller request limiting.
 *
 * State lives in the function instance, so the effective limit is per warm
 * instance rather than global. That is a real weakness and an acceptable one at
 * this scale: authentication is what stops anonymous abuse, and this only has to
 * stop a single authenticated user from draining the model budget. Move the
 * counters to Redis or Firestore when traffic justifies it.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Stops the map growing without bound on a long-lived instance.
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_TRACKED_KEYS) evictExpired(now);
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: options.limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  // Everything is still live: drop the oldest-resetting entries so a burst of
  // unique callers cannot pin memory.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [key] of sorted.slice(0, Math.floor(MAX_TRACKED_KEYS / 4))) {
      buckets.delete(key);
    }
  }
}

/** Test seam. */
export function __resetRateLimits(): void {
  buckets.clear();
}

/** Model-backed routes: expensive per call, so the ceiling is low. */
export const AI_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 };

/** Scrape and lookup routes: cheap for us, but they hit third parties from our IP. */
export const SCRAPE_LIMIT: RateLimitOptions = { limit: 60, windowMs: 60_000 };
