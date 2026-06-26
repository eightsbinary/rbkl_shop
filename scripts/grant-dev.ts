#!/usr/bin/env bun
// Promote a user to 'dev' role.
// Usage: bun run grant:dev -- you@email.com
// This is the ONLY way to create the first dev. Subsequent dev grants go through
// the in-app role management UI (built in a later plan).

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/db/types.gen';

const email = process.argv[2];
if (!email) {
  console.error('Usage: bun run grant:dev -- <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('For production: `vercel env pull .env.production.local` first.');
  process.exit(1);
}

const supa = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supa.auth.admin.listUsers();
if (error) {
  console.error('listUsers failed:', error.message);
  process.exit(1);
}

const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No user found with email ${email}. Ask them to sign in first.`);
  process.exit(1);
}

const { error: updateErr } = await supa.from('profiles').update({ role: 'dev' }).eq('id', user.id);

if (updateErr) {
  console.error('update failed:', updateErr.message);
  process.exit(1);
}

console.log(`Granted 'dev' to ${email} (id: ${user.id}).`);
