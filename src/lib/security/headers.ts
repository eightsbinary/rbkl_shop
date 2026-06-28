export interface HeaderOpts {
  isDev: boolean;
  supabaseHost: string;
  nonce?: string;
}

/** HTTP security headers + a pragmatic CSP. In dev, the CSP also allows the
 *  Next HMR websocket and eval; production omits both. When a `nonce` is given
 *  (admin routes), script-src uses the nonce and drops 'unsafe-inline'; style-src
 *  keeps 'unsafe-inline' (React style attributes can't be nonced). */
export function securityHeaders({
  isDev,
  supabaseHost,
  nonce,
}: HeaderOpts): Record<string, string> {
  const turnstile = 'https://challenges.cloudflare.com';
  const connect = ["'self'", supabaseHost, turnstile, isDev ? 'ws: wss:' : ''].filter(Boolean);
  const scriptInline = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'";
  // 'self' is intentional (no user-controlled script endpoints on this origin), so we skip 'strict-dynamic'.
  // 'unsafe-eval' is added only in the isDev branch; it is required for Next HMR in dev.
  const script = ["'self'", scriptInline, turnstile, isDev ? "'unsafe-eval'" : ''].filter(Boolean);

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
