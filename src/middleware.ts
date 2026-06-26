import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Forward pathname so layouts can read it via the x-pathname header.
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);

  // Admin routes are single-locale (TH copy in UI) and gated separately.
  // API routes never get locale rewriting.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    return NextResponse.next({ request: { headers } });
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
