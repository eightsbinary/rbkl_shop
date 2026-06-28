/** True when occurredAt is within windowMs of now in either direction. The
 *  symmetric check rejects both stale replays and far-future (skewed) stamps. */
export function isFresh(occurredAt: number, now: number, windowMs: number): boolean {
  return Math.abs(now - occurredAt) <= windowMs;
}
