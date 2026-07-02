import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/db/server';

/**
 * Completes magic-link sign-in. The email link returns here with a PKCE `?code=`;
 * we exchange it for a session (sets the auth cookies) and forward to `next`.
 * Without this route the code is never exchanged, so the /admin guard sees no
 * session and bounces back to /admin/login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Only allow same-origin relative paths — never an attacker-supplied absolute
  // or protocol-relative URL (open-redirect guard).
  const nextParam = searchParams.get('next');
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/admin';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=auth`);
}
