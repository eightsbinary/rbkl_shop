import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { securityHeaders } from '@/lib/security/headers';

const intlMiddleware = createIntlMiddleware(routing);

function supabaseHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
}

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith('/admin');
  const isApi = pathname.startsWith('/api');

  // Nonce CSP only on /admin (already dynamic + auth-gated). Storefront and /api
  // keep the pragmatic CSP so storefront pages stay statically cacheable.
  const nonce = isAdmin ? makeNonce() : undefined;
  const headerMap = securityHeaders({
    isDev: process.env.NODE_ENV !== 'production',
    supabaseHost: supabaseHost(),
    nonce,
  });

  const reqHeaders = new Headers(request.headers);
  reqHeaders.set('x-pathname', pathname);
  if (nonce) {
    // Next reads the nonce from the CSP request header and applies it to its
    // own bootstrap scripts.
    reqHeaders.set('x-nonce', nonce);
    reqHeaders.set('Content-Security-Policy', headerMap['Content-Security-Policy'] ?? '');
  }

  const response =
    isAdmin || isApi
      ? NextResponse.next({ request: { headers: reqHeaders } })
      : (intlMiddleware(request) as NextResponse);

  for (const [k, v] of Object.entries(headerMap)) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
