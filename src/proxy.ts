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

function withSecurity(response: NextResponse): NextResponse {
  const headers = securityHeaders({
    isDev: process.env.NODE_ENV !== 'production',
    supabaseHost: supabaseHost(),
  });
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);

  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    return withSecurity(NextResponse.next({ request: { headers } }));
  }

  return withSecurity(intlMiddleware(request) as NextResponse);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
