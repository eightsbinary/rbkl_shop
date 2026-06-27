export interface RateResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateResult>;
}
