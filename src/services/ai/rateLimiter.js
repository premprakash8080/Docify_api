/**
 * Per-user in-memory token bucket. Cheap and good enough for a single-instance
 * deployment; swap for Redis-backed limiting if the app ever runs multi-node.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_PER_MIN) || 30;

const buckets = new Map();

function check(userId) {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }
  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - bucket.count,
    resetAt: bucket.resetAt,
  };
}

module.exports = { check, MAX_REQUESTS };
