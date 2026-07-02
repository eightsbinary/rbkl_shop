// Pure helpers for scripts/setup-sheets-env.ts — turning a downloaded Google
// service-account key + sheet URL into the .env.local lines the sync reads.

/** Pull the spreadsheet id out of a docs.google.com URL, or pass a bare id through. */
export function extractSpreadsheetId(input: string): string | null {
  const fromUrl = input.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(input)) return input;
  return null;
}

/**
 * Validate a downloaded service-account key and reduce it to the one-line JSON
 * value `sheetsClientFromEnv` reads (`client_email` + `private_key`, with the
 * key's newlines kept as `\n` escapes). The value is later wrapped in single
 * quotes in .env.local, so single quotes inside would truncate it.
 */
export function buildServiceAccountEnvValue(rawJson: string): {
  value: string;
  clientEmail: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Key file is not valid JSON — download the key as JSON from Google Cloud.');
  }
  const key = parsed as { type?: string; client_email?: string; private_key?: string };
  if (key.type !== 'service_account') {
    throw new Error(`Expected a service_account key, got type "${key.type ?? 'missing'}".`);
  }
  if (!key.client_email || !key.private_key) {
    throw new Error('Key is missing client_email or private_key.');
  }
  const value = JSON.stringify({ client_email: key.client_email, private_key: key.private_key });
  if (value.includes("'")) {
    throw new Error('Key contains a single quote, which would break the quoted .env line.');
  }
  return { value, clientEmail: key.client_email };
}

/** Replace `KEY=...` lines in dotenv content (or append missing keys). */
export function upsertEnvVars(content: string, vars: Record<string, string>): string {
  let out = content;
  for (const [name, value] of Object.entries(vars)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    out = pattern.test(out) ? out.replace(pattern, line) : `${out}${line}\n`;
  }
  return out;
}
