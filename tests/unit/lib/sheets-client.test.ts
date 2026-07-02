import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getAccessToken = vi.fn(async () => ({ token: 'tok_123' }));
vi.mock('google-auth-library', () => ({
  JWT: class {
    getAccessToken = getAccessToken;
  },
}));

const { SheetsClient } = await import('@/lib/sheets/client');

beforeEach(() => {
  vi.unstubAllGlobals();
  getAccessToken.mockClear();
});

describe('SheetsClient.getValues', () => {
  it('normalizes UNFORMATTED_VALUE cells (numbers, booleans) to strings', async () => {
    // UNFORMATTED_VALUE returns native JSON types; the sync layer expects a
    // string grid matching the DB snapshot's serialization.
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            values: [
              ['pk', 'version', 'price_thb', 'is_active'],
              ['v1', 2, 590, true],
              ['v2', 1, null, false],
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new SheetsClient({
      clientEmail: 'svc@x.iam',
      privateKey: 'KEY',
      spreadsheetId: 'SID',
    });
    // Booleans render as TRUE/FALSE — the same convention readSnapshot uses,
    // so a pushed value that Sheets coerced to a boolean cell doesn't read
    // back as a spurious edit on every cycle.
    expect(await client.getValues('variants')).toEqual([
      ['pk', 'version', 'price_thb', 'is_active'],
      ['v1', '2', '590', 'TRUE'],
      ['v2', '1', '', 'FALSE'],
    ]);
  });

  it('creates the tab and returns an empty grid when the range 400s (missing tab)', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      calls.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body as string | undefined,
      });
      // First read 400s (tab missing); the batchUpdate that creates it succeeds.
      if (calls.length === 1) return new Response('bad range', { status: 400 });
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new SheetsClient({
      clientEmail: 'svc@x.iam',
      privateKey: 'KEY',
      spreadsheetId: 'SID',
    });
    const grid = await client.getValues('products');

    expect(grid).toEqual([]);
    expect(calls[1]?.url).toContain('/SID:batchUpdate');
    expect(calls[1]?.method).toBe('POST');
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({
      requests: [{ addSheet: { properties: { title: 'products' } } }],
    });
  });

  it('still throws on non-400 failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response('forbidden', { status: 403 })),
    );
    const client = new SheetsClient({
      clientEmail: 'svc@x.iam',
      privateKey: 'KEY',
      spreadsheetId: 'SID',
    });
    await expect(client.getValues('products')).rejects.toThrow('403');
  });

  it('GETs the A1 range with a bearer token and returns the value grid', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            values: [
              ['pk', 'version'],
              ['v1', '2'],
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new SheetsClient({
      clientEmail: 'svc@x.iam',
      privateKey: 'KEY',
      spreadsheetId: 'SID',
    });
    const grid = await client.getValues('variants');

    expect(grid).toEqual([
      ['pk', 'version'],
      ['v1', '2'],
    ]);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/SID/values/variants');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok_123' });
  });
});

describe('SheetsClient.updateValues', () => {
  it('PUTs the grid to the tab range with USER_ENTERED input', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new SheetsClient({
      clientEmail: 'svc@x.iam',
      privateKey: 'KEY',
      spreadsheetId: 'SID',
    });
    await client.updateValues('variants', [
      ['pk', 'version'],
      ['v1', '3'],
    ]);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect((init as RequestInit).method).toBe('PUT');
    expect(String(url)).toContain('valueInputOption=USER_ENTERED');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      values: [
        ['pk', 'version'],
        ['v1', '3'],
      ],
    });
  });
});
