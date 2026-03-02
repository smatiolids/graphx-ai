const WINDOW_MS = 60_000;
const LIMIT = 20;

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function assertWithinRateLimit(sessionId: string): void {
  const now = Date.now();
  const current = buckets.get(sessionId);

  if (!current || current.resetAt <= now) {
    buckets.set(sessionId, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (current.count >= LIMIT) {
    throw new Error("Rate limit exceeded for this session. Retry in under a minute.");
  }

  current.count += 1;
  buckets.set(sessionId, current);
}
