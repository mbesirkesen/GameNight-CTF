const buckets = new Map();

/** Basit bellek içi rate limit. */
export function rateLimit({
  key,
  limit = 20,
  windowMs = 60_000,
} = {}) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterMs = windowMs - (now - bucket.start);
    return {
      ok: false,
      retryAfterMs: Math.max(1000, retryAfterMs),
    };
  }
  return { ok: true, remaining: limit - bucket.count };
}

export function clearRateLimits() {
  buckets.clear();
}
