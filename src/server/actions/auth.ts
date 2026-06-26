'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/db/client';

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email required' };
  const supa = await createServerSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/admin` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function signOutAdmin() {
  const supa = await createServerSupabase();
  await supa.auth.signOut();
  redirect('/admin/login');
}
