/**
 * Tiny in-memory rate limiter for the login endpoint (audit P1-5: the panel
 * happily answered twelve failed logins in a row with no delay and no record).
 *
 * Deliberately in-memory: the panel is a single process behind one admin, and a
 * shared store would be a new dependency for no gain. A restart clears the
 * counters — acceptable, because the goal is to stop offline guessing, not to
 * survive a process restart.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateResult {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

export function hit(key: string, limit = 8, windowMs = 10 * 60_000): RateResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: limit - 1 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000), remaining: 0 };
  }
  return { allowed: true, retryAfterSec: 0, remaining: limit - b.count };
}

/** Clears the counter after a successful login. */
export function reset(key: string): void {
  buckets.delete(key);
}

/** Keeps the map from growing without bound in a long-lived process. */
export function sweep(now = Date.now()): void {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}
