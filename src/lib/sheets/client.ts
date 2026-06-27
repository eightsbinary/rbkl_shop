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
    if (!res.ok) throw new Error(`Sheets getValues ${tab} failed: ${res.status}`);
    const json = (await res.json()) as { values?: string[][] };
    return json.values ?? [];
  }

  /** Overwrite a tab starting at A1 with the given grid. */
  async updateValues(tab: string, values: string[][]): Promise<void> {
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
