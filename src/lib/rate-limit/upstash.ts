import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { RateLimiter, RateResult } from './types';

/** Distributed sliding-window limiter backed by Upstash Redis. */
export class UpstashLimiter implements RateLimiter {
  private rl: Ratelimit;

  constructor(url: string, token: string, max: number, windowMs: number) {
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    this.rl = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(max, `${seconds} s`),
      prefix: 'rb_rl',
    });
  }

  async limit(key: string): Promise<RateResult> {
    const r = await this.rl.limit(key);
    return { ok: r.success, remaining: r.remaining, resetAt: r.reset };
  }
}
