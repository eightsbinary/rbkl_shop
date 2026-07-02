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
