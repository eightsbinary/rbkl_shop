import { describe, expect, it } from 'vitest';
import { isFresh } from '@/lib/webhook/freshness';

describe('isFresh', () => {
  const W = 5 * 60_000;
  it('accepts an event within the window', () => {
    expect(isFresh(1_000_000, 1_000_000 + 60_000, W)).toBe(true);
  });
  it('rejects an event older than the window', () => {
    expect(isFresh(1_000_000, 1_000_000 + 6 * 60_000, W)).toBe(false);
  });
  it('rejects a far-future event (clock-skew abuse)', () => {
    expect(isFresh(1_000_000 + 6 * 60_000, 1_000_000, W)).toBe(false);
  });
  it('treats the exact boundary as fresh', () => {
    expect(isFresh(1_000_000, 1_000_000 + W, W)).toBe(true);
  });
});
