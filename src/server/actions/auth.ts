'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/db/server';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email required' };

  const ip = await clientIp();
  const token = String(formData.get('turnstileToken') ?? '');
  const byIp = await enforceRateLimit('login-ip', ip, { max: 5, windowMs: 600_000 });
  const byEmail = await enforceRateLimit('login-email', email.toLowerCase(), {
    max: 5,
    windowMs: 600_000,
  });
  if (!byIp.ok || !byEmail.ok) return { error: 'Too many sign-in attempts — please wait.' };
  if (!(await verifyTurnstile(token, ip))) return { error: 'Verification failed — please retry.' };

  const supa = await createServerSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/api/auth/callback?next=/admin` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function signOutAdmin() {
  const supa = await createServerSupabase();
  await supa.auth.signOut();
  redirect('/admin/login');
}

export async function resendStepUpLink(): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  const { data } = await supa.auth.getUser();
  const email = data.user?.email;
  if (!email) return { error: 'Not signed in' };

  const ip = await clientIp();
  const rl = await enforceRateLimit('stepup-ip', ip, { max: 5, windowMs: 600_000 });
  if (!rl.ok) return { error: 'Too many attempts — please wait.' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/api/auth/callback?next=/admin` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}
