import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { verifyTurnstile } = await import('@/lib/turnstile');

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('verifyTurnstile', () => {
  it('bypasses (returns true) with no secret configured and does not call fetch', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyTurnstile('tok')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when Cloudflare reports success', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true }))),
    );
    expect(await verifyTurnstile('tok', '1.2.3.4')).toBe(true);
  });

  it('returns false when Cloudflare reports failure', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false }))),
    );
    expect(await verifyTurnstile('tok')).toBe(false);
  });

  it('returns false (fails closed) when the request throws', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    expect(await verifyTurnstile('tok')).toBe(false);
  });
});
