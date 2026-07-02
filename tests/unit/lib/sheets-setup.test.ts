import { describe, expect, it } from 'vitest';
import {
  buildServiceAccountEnvValue,
  extractSpreadsheetId,
  upsertEnvVars,
} from '@/lib/sheets/setup';

const KEY_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'rb-shop',
  private_key_id: 'abc123',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIB\nADANBg\n-----END PRIVATE KEY-----\n',
  client_email: 'sheets-sync@rb-shop.iam.gserviceaccount.com',
  client_id: '1234567890',
  token_uri: 'https://oauth2.googleapis.com/token',
});

describe('extractSpreadsheetId', () => {
  it('extracts the id from a full sheet URL', () => {
    expect(
      extractSpreadsheetId(
        'https://docs.google.com/spreadsheets/d/1AbC-dEf_GhIjKlMnOpQrStUvWxYz0123456789abcdef/edit?gid=0#gid=0',
      ),
    ).toBe('1AbC-dEf_GhIjKlMnOpQrStUvWxYz0123456789abcdef');
  });

  it('accepts a bare id unchanged', () => {
    expect(extractSpreadsheetId('1AbC-dEf_GhIjKlMnOpQrStUvWxYz0123456789abcdef')).toBe(
      '1AbC-dEf_GhIjKlMnOpQrStUvWxYz0123456789abcdef',
    );
  });

  it('rejects things that are neither a sheet URL nor an id', () => {
    expect(extractSpreadsheetId('https://docs.google.com/document/d/xyz/edit')).toBeNull();
    expect(extractSpreadsheetId('not an id')).toBeNull();
  });
});

describe('buildServiceAccountEnvValue', () => {
  it('produces a single-line JSON value with only the fields the app reads', () => {
    const { value, clientEmail } = buildServiceAccountEnvValue(KEY_JSON);
    expect(clientEmail).toBe('sheets-sync@rb-shop.iam.gserviceaccount.com');
    expect(value).not.toContain('\n'); // one line for .env.local
    const parsed = JSON.parse(value) as Record<string, string>;
    expect(parsed).toEqual({
      client_email: 'sheets-sync@rb-shop.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIB\nADANBg\n-----END PRIVATE KEY-----\n',
    });
  });

  it('round-trips through the runtime client parsing (escaped newlines survive)', () => {
    const { value } = buildServiceAccountEnvValue(KEY_JSON);
    // Mirrors sheetsClientFromEnv: JSON.parse then unescape \n
    const creds = JSON.parse(value) as { private_key: string };
    expect(creds.private_key.replace(/\\n/g, '\n')).toContain('-----BEGIN PRIVATE KEY-----\n');
  });

  it('rejects invalid JSON', () => {
    expect(() => buildServiceAccountEnvValue('{oops')).toThrow(/JSON/i);
  });

  it('rejects a non-service-account key', () => {
    const wrong = JSON.stringify({ type: 'authorized_user', client_email: 'x', private_key: 'y' });
    expect(() => buildServiceAccountEnvValue(wrong)).toThrow(/service_account/);
  });

  it('rejects a key missing required fields', () => {
    const wrong = JSON.stringify({ type: 'service_account', client_email: 'x@y.iam' });
    expect(() => buildServiceAccountEnvValue(wrong)).toThrow(/private_key/);
  });

  it('rejects a value containing single quotes (would break the quoted env line)', () => {
    const wrong = JSON.stringify({
      type: 'service_account',
      client_email: "x'@y.iam",
      private_key: 'k',
    });
    expect(() => buildServiceAccountEnvValue(wrong)).toThrow(/single quote/i);
  });
});

describe('upsertEnvVars', () => {
  it('replaces existing empty assignments in place', () => {
    const content = '# Sheets\nGOOGLE_SERVICE_ACCOUNT_JSON=\nGOOGLE_SHEETS_SPREADSHEET_ID=\n';
    const out = upsertEnvVars(content, {
      GOOGLE_SERVICE_ACCOUNT_JSON: '\'{"a":1}\'',
      GOOGLE_SHEETS_SPREADSHEET_ID: 'SID123',
    });
    expect(out).toBe(
      '# Sheets\nGOOGLE_SERVICE_ACCOUNT_JSON=\'{"a":1}\'\nGOOGLE_SHEETS_SPREADSHEET_ID=SID123\n',
    );
  });

  it('replaces existing non-empty assignments', () => {
    const content = 'GOOGLE_SHEETS_SPREADSHEET_ID=old\n';
    const out = upsertEnvVars(content, { GOOGLE_SHEETS_SPREADSHEET_ID: 'new' });
    expect(out).toBe('GOOGLE_SHEETS_SPREADSHEET_ID=new\n');
  });

  it('appends keys that are not present yet', () => {
    const out = upsertEnvVars('OTHER=1\n', { GOOGLE_SHEETS_SPREADSHEET_ID: 'SID' });
    expect(out).toBe('OTHER=1\nGOOGLE_SHEETS_SPREADSHEET_ID=SID\n');
  });

  it('leaves unrelated lines untouched', () => {
    const content = 'A=1\nGOOGLE_SHEETS_SPREADSHEET_ID=\nB=2\n';
    const out = upsertEnvVars(content, { GOOGLE_SHEETS_SPREADSHEET_ID: 'SID' });
    expect(out).toBe('A=1\nGOOGLE_SHEETS_SPREADSHEET_ID=SID\nB=2\n');
  });
});
