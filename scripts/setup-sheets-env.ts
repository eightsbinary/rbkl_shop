#!/usr/bin/env bun
// Fill GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_SHEETS_SPREADSHEET_ID in .env.local
// from a downloaded service-account key and the sheet's URL.
// Usage: bun run sheets:env -- <path-to-key.json> <sheet-url-or-id>
// (A key downloaded on Windows is reachable from WSL at /mnt/c/Users/<you>/Downloads/…)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildServiceAccountEnvValue,
  extractSpreadsheetId,
  upsertEnvVars,
} from '@/lib/sheets/setup';

const [keyPath, sheetArg] = process.argv.slice(2);
if (!keyPath || !sheetArg) {
  console.error('Usage: bun run sheets:env -- <path-to-key.json> <sheet-url-or-id>');
  process.exit(1);
}
if (!existsSync(keyPath)) {
  console.error(`Key file not found: ${keyPath}`);
  process.exit(1);
}

const spreadsheetId = extractSpreadsheetId(sheetArg);
if (!spreadsheetId) {
  console.error(`Could not find a spreadsheet id in: ${sheetArg}`);
  console.error('Paste the full sheet URL (docs.google.com/spreadsheets/d/…) or the bare id.');
  process.exit(1);
}

let value: string;
let clientEmail: string;
try {
  ({ value, clientEmail } = buildServiceAccountEnvValue(readFileSync(keyPath, 'utf8')));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const envPath = '.env.local';
const before = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
writeFileSync(
  envPath,
  upsertEnvVars(before, {
    GOOGLE_SERVICE_ACCOUNT_JSON: `'${value}'`,
    GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId,
  }),
);

console.log(`✓ ${envPath} updated`);
console.log(`  GOOGLE_SHEETS_SPREADSHEET_ID=${spreadsheetId}`);
console.log(`  GOOGLE_SERVICE_ACCOUNT_JSON=<${clientEmail}>`);
console.log('');
console.log('Remaining manual step — share the sheet with the service account:');
console.log(`  Open the sheet → Share → add ${clientEmail} as Editor.`);
console.log('Then restart the dev server so it picks up the new env.');
