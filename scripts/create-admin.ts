#!/usr/bin/env bun
// Provision an admin (owner) account. Login uses shouldCreateUser: false, so
// the account must exist before a magic link can ever be sent — run this once
// per environment (local dev after each `db reset`; prod at bootstrap).
// Usage: bun run create:admin -- her@email.com

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/db/types.gen';

const email = process.argv[2];
if (!email) {
  console.error('Usage: bun run create:admin -- <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('For production: `vercel env pull .env.production.local` first.');
  process.exit(1);
}

const supa = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Create the user (confirmed — magic-link login still verifies mailbox access).
const { data: created, error: createErr } = await supa.auth.admin.createUser({
  email,
  email_confirm: true,
});

let userId = created?.user?.id;
if (createErr) {
  // Already registered is fine — we just promote below.
  const { data, error } = await supa.auth.admin.listUsers();
  if (error) {
    console.error('createUser failed:', createErr.message);
    process.exit(1);
  }
  userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) {
    console.error('createUser failed:', createErr.message);
    process.exit(1);
  }
  console.log(`User ${email} already exists — promoting to owner.`);
}
if (!userId) {
  console.error('User created but no id returned — check the account in Studio.');
  process.exit(1);
}

const { error: updateErr } = await supa.from('profiles').update({ role: 'owner' }).eq('id', userId);
if (updateErr) {
  console.error('role update failed:', updateErr.message);
  process.exit(1);
}

console.log(`✓ ${email} can now sign in at /admin/login as owner (id: ${userId}).`);
