import 'server-only';
import { headers } from 'next/headers';
import { MemoryLimiter } from './memory';
import type { RateLimiter, RateResult } from './types';
import { UpstashLimiter } from './upstash';

export type { RateResult } from './types';

const registry = new Map<string, RateLimiter>();

function limiterFor(bucket: string, max: number, windowMs: number): RateLimiter {
  const id = `${bucket}:${max}:${windowMs}`;
  const existing = registry.get(id);
  if (existing) return existing;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const limiter: RateLimiter =
    url && token ? new UpstashLimiter(url, token, max, windowMs) : new MemoryLimiter(max, windowMs);
  registry.set(id, limiter);
  return limiter;
}

/** Run a rate-limit check. Fails OPEN (ok:true) if the backend throws — limiting
 *  is a mitigation, not a hard gate, and must never block a legitimate request. */
export async function enforceRateLimit(
  bucket: string,
  key: string,
  opts: { max: number; windowMs: number },
): Promise<RateResult> {
  try {
    return await limiterFor(bucket, opts.max, opts.windowMs).limit(`${bucket}:${key}`);
  } catch (err) {
    console.error('[rate-limit] backend error, failing open', err);
    return { ok: true, remaining: 0, resetAt: Date.now() };
  }
}

/** Best-effort client IP from the forwarded headers (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
