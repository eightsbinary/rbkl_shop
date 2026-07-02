import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';

// next-intl's middleware does a bare `import 'next/server'` that vitest can't
// resolve. Our /admin and /api paths take the NextResponse.next branch and never
// invoke it, so a trivial stub keeps the module graph loadable.
vi.mock('next-intl/middleware', () => ({ default: () => () => null }));

function scriptSrc(req: NextRequest): string {
  const res = proxy(req);
  const csp = res.headers.get('content-security-policy') ?? '';
  return csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
}

describe('proxy CSP wiring', () => {
  it('applies a nonce CSP (no script unsafe-inline) on /admin', () => {
    const src = scriptSrc(new NextRequest('http://localhost/admin/login'));
    expect(src).toContain("'nonce-");
    expect(src).not.toContain("'unsafe-inline'");
  });

  it('keeps the non-nonce CSP (script unsafe-inline) on /api', () => {
    const src = scriptSrc(new NextRequest('http://localhost/api/health'));
    expect(src).toContain("'unsafe-inline'");
    expect(src).not.toContain("'nonce-");
  });
});
