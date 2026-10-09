/**
 * In-memory fixed-window limiter (one server process). Protects provider quotas from one busy client;
 * sign-in endpoints have Better Auth's own limits.
 */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = Date.now() + windowMs;

  return function allow(key: string): boolean {
    const now = Date.now();
    if (now > nextSweep) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      nextSweep = now + windowMs;
    }
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= max;
  };
}
