#!/usr/bin/env bun
// Render the auth (Supabase-sent) email templates to static HTML.
// Usage: bun run emails:auth
// Local Supabase reads the file via config.toml; for hosted Supabase paste the
// file's contents into Dashboard → Auth → Emails → Magic Link.

import { mkdirSync, writeFileSync } from 'node:fs';
import { render } from '@react-email/components';
import SignIn, { subject } from 'emails/SignIn';

const OUT = 'supabase/templates/magic_link.html';

const html = await render(SignIn());
if (!html.includes('href="{{ .ConfirmationURL }}"')) {
  console.error('Rendered HTML lost the {{ .ConfirmationURL }} placeholder — aborting.');
  process.exit(1);
}

mkdirSync('supabase/templates', { recursive: true });
writeFileSync(OUT, html);
console.log(`✓ ${OUT} written`);
console.log(`  subject: ${subject()}`);
console.log('Local: restart supabase (supabase stop && supabase start) to apply.');
