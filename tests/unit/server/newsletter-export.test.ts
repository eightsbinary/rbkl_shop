import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';

const { requireMock, state } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  state: {
    rows: [] as Array<Record<string, unknown>>,
    error: null as { message: string } | null,
  },
}));

vi.mock('@/db/auth', async (orig) => {
  const actual = await orig<typeof import('@/db/auth')>();
  return { ...actual, requireOwnerOrDev: requireMock };
});
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => ({
    from: () => ({
      select: () => ({ order: async () => ({ data: state.rows, error: state.error }) }),
    }),
  }),
}));

import { GET } from '@/app/api/admin/newsletter/export/route';

describe('GET /api/admin/newsletter/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMock.mockResolvedValue(undefined);
    state.rows = [];
    state.error = null;
  });

  it('returns 403 for a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('streams CSV with header + escaped rows and attachment headers', async () => {
    state.rows = [
      {
        email: 'a@b.com',
        locale: 'th',
        source: 'home_band',
        status: 'active',
        created_at: '2026-07-01T00:00:00Z',
      },
      {
        email: 'c@d.com',
        locale: 'en',
        source: null,
        status: 'active',
        created_at: '2026-07-02T00:00:00Z',
      },
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const lines = (await res.text()).split('\r\n');
    expect(lines[0]).toBe('email,locale,source,status,created_at');
    expect(lines[1]).toBe('"a@b.com","th","home_band","active","2026-07-01T00:00:00Z"');
    expect(lines[2]).toBe('"c@d.com","en","","active","2026-07-02T00:00:00Z"');
  });

  it('returns 500 when the DB query errors', async () => {
    state.error = { message: 'boom' };
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('escapes embedded quotes and commas', async () => {
    state.rows = [
      {
        email: 'weird"n@b.com',
        locale: 'th',
        source: 'a,b',
        status: 'active',
        created_at: '2026-07-01T00:00:00Z',
      },
    ];
    const body = await (await GET()).text();
    expect(body).toContain('"weird""n@b.com"');
    expect(body).toContain('"a,b"');
  });
});
