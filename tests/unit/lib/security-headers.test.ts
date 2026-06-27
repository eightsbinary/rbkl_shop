import { describe, expect, it } from 'vitest';
import { securityHeaders } from '@/lib/security/headers';

describe('securityHeaders', () => {
  it('includes the core hardening headers', () => {
    const h = securityHeaders({ isDev: false, supabaseHost: 'https://abc.supabase.co' });
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Strict-Transport-Security']).toContain('max-age=');
    expect(h['Permissions-Policy']).toContain('camera=()');
  });

  it('builds a CSP that allows self, the supabase host, and turnstile', () => {
    const csp = securityHeaders({ isDev: false, supabaseHost: 'https://abc.supabase.co' })[
      'Content-Security-Policy'
    ];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://abc.supabase.co');
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('relaxes connect/script for the dev HMR websocket only in development', () => {
    const dev = securityHeaders({ isDev: true, supabaseHost: 'https://abc.supabase.co' })[
      'Content-Security-Policy'
    ];
    const prod = securityHeaders({ isDev: false, supabaseHost: 'https://abc.supabase.co' })[
      'Content-Security-Policy'
    ];
    expect(dev).toContain('ws:');
    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain('ws:');
    expect(prod).not.toContain("'unsafe-eval'");
  });
});
