import 'server-only';
import { JWT } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetsConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

export class SheetsClient {
  private jwt: JWT;
  private spreadsheetId: string;

  constructor(cfg: SheetsConfig) {
    this.spreadsheetId = cfg.spreadsheetId;
    this.jwt = new JWT({ email: cfg.clientEmail, key: cfg.privateKey, scopes: SCOPES });
  }

  private async token(): Promise<string> {
    const { token } = await this.jwt.getAccessToken();
    if (!token) throw new Error('Sheets auth failed: no access token');
    return token;
  }

  /** Read a whole tab (range = tab name) as a 2-D string grid. */
  async getValues(tab: string): Promise<string[][]> {
    // UNFORMATTED_VALUE so locale number formatting (e.g. '1,000') can't cause
    // spurious diffs against the DB snapshot's plain string serialization.
    const url =
      `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(tab)}` +
      `?valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await this.token()}` } });
    if (res.status === 400) {
      // An unparseable range means the tab doesn't exist yet (fresh spreadsheet).
      // Create it and report it empty; the sync cycle then pushes the DB
      // snapshot into it, so setup needs no manual tab creation.
      await this.addTab(tab);
      return [];
    }
    if (!res.ok) throw new Error(`Sheets getValues ${tab} failed: ${res.status}`);
    // UNFORMATTED_VALUE returns native JSON types (numbers, booleans) — the
    // sync layer expects strings matching the DB snapshot's serialization
    // (booleans as TRUE/FALSE, per readSnapshot), or every pushed boolean
    // cell would read back as a spurious edit on the next cycle.
    const json = (await res.json()) as { values?: unknown[][] };
    return (json.values ?? []).map((row) =>
      row.map((cell) => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
        return String(cell);
      }),
    );
  }

  /** Create an empty tab with the given title. */
  private async addTab(tab: string): Promise<void> {
    const res = await fetch(`${BASE}/${this.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    });
    if (!res.ok) throw new Error(`Sheets addTab ${tab} failed: ${res.status}`);
  }

  /** Overwrite a tab with the given grid. Clears first — values.update only
   *  covers the written range, so rows deleted from the DB would otherwise
   *  linger below the fresh grid forever. */
  async updateValues(tab: string, values: string[][]): Promise<void> {
    const clearRes = await fetch(
      `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(tab)}:clear`,
      { method: 'POST', headers: { Authorization: `Bearer ${await this.token()}` } },
    );
    if (!clearRes.ok) throw new Error(`Sheets clear ${tab} failed: ${clearRes.status}`);

    const range = `${tab}!A1`;
    const url =
      `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(range)}` +
      `?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error(`Sheets updateValues ${tab} failed: ${res.status}`);
  }
}

/** Build a client from env, or null if Sheets isn't configured. */
export function sheetsClientFromEnv(): SheetsClient | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!raw || !spreadsheetId) return null;
  const creds = JSON.parse(raw) as { client_email: string; private_key: string };
  return new SheetsClient({
    clientEmail: creds.client_email,
    privateKey: creds.private_key.replace(/\\n/g, '\n'),
    spreadsheetId,
  });
}
