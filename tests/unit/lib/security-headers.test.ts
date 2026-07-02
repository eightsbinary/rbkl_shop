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

  it('uses a nonce and drops script unsafe-inline when a nonce is provided', () => {
    const csp =
      securityHeaders({
        isDev: false,
        supabaseHost: 'https://abc.supabase.co',
        nonce: 'abc123',
      })['Content-Security-Policy'] ?? '';
    expect(csp).toContain("'nonce-abc123'");
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).toContain('https://challenges.cloudflare.com');
  });

  it('keeps style-src unsafe-inline even with a nonce', () => {
    const csp =
      securityHeaders({
        isDev: false,
        supabaseHost: 'https://abc.supabase.co',
        nonce: 'abc123',
      })['Content-Security-Policy'] ?? '';
    const styleSrc = csp.split('; ').find((d) => d.startsWith('style-src')) ?? '';
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it('falls back to script unsafe-inline without a nonce', () => {
    const csp =
      securityHeaders({ isDev: false, supabaseHost: 'https://abc.supabase.co' })[
        'Content-Security-Policy'
      ] ?? '';
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scriptSrc).toContain("'unsafe-inline'");
  });
});
