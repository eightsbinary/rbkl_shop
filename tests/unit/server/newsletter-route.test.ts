import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rateLimitMock, clientIpMock, insertMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(async () => ({ ok: true })),
  clientIpMock: vi.fn(async () => '1.2.3.4'),
  insertMock: vi.fn(async () => ({ error: null as { code: string } | null })),
}));

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: rateLimitMock, clientIp: clientIpMock }));
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => ({ from: () => ({ insert: insertMock }) }),
}));

import { POST } from '@/app/api/newsletter/route';

function req(body: unknown): Request {
  return new Request('http://localhost/api/newsletter', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/newsletter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ ok: true });
    insertMock.mockResolvedValue({ error: null });
  });

  it('stores a valid subscriber (lowercased) and returns ok', async () => {
    const res = await POST(req({ email: 'Fan@Example.com', locale: 'th' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({
      email: 'fan@example.com',
      locale: 'th',
      source: 'home_band',
    });
  });

  it('rejects malformed input with 400 and no insert', async () => {
    const res = await POST(req({ email: 'not-an-email', locale: 'th' }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('treats a duplicate (23505) as success', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } });
    const res = await POST(req({ email: 'dup@example.com', locale: 'en' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('returns 429 when rate-limited, without inserting', async () => {
    rateLimitMock.mockResolvedValue({ ok: false });
    const res = await POST(req({ email: 'fan@example.com', locale: 'en' }));
    expect(res.status).toBe(429);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected DB error', async () => {
    insertMock.mockResolvedValue({ error: { code: '42P01' } });
    const res = await POST(req({ email: 'fan@example.com', locale: 'en' }));
    expect(res.status).toBe(500);
  });
});
