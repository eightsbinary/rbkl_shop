import { describe, expect, it } from 'vitest';
import { MemoryLimiter } from '@/lib/rate-limit/memory';

describe('MemoryLimiter', () => {
  it('allows up to max requests in a window, then blocks', async () => {
    const l = new MemoryLimiter(2, 1000, () => 1000);
    expect((await l.limit('a')).ok).toBe(true);
    expect((await l.limit('a')).ok).toBe(true);
    const third = await l.limit('a');
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('resets after the window elapses', async () => {
    let now = 1000;
    const l = new MemoryLimiter(1, 1000, () => now);
    expect((await l.limit('a')).ok).toBe(true);
    expect((await l.limit('a')).ok).toBe(false);
    now = 2000; // window elapsed
    expect((await l.limit('a')).ok).toBe(true);
  });

  it('tracks keys independently', async () => {
    const l = new MemoryLimiter(1, 1000, () => 1000);
    expect((await l.limit('a')).ok).toBe(true);
    expect((await l.limit('b')).ok).toBe(true);
    expect((await l.limit('a')).ok).toBe(false);
  });
});
