export interface HeaderOpts {
  isDev: boolean;
  supabaseHost: string;
}

/** HTTP security headers + a pragmatic CSP. In dev, the CSP also allows the
 *  Next HMR websocket and eval; production omits both. */
export function securityHeaders({ isDev, supabaseHost }: HeaderOpts): Record<string, string> {
  const turnstile = 'https://challenges.cloudflare.com';
  const connect = ["'self'", supabaseHost, turnstile, isDev ? 'ws: wss:' : ''].filter(Boolean);
  const script = ["'self'", "'unsafe-inline'", turnstile, isDev ? "'unsafe-eval'" : ''].filter(
    Boolean,
  );

  const csp = [
    "default-src 'self'",
    `img-src 'self' data: blob: ${supabaseHost}`,
    `connect-src ${connect.join(' ')}`,
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `frame-src ${turnstile}`,
    "font-src 'self' data:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}
