# Plan 6a — Security hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app safe to deploy — security headers + a pragmatic CSP, rate limiting on sensitive endpoints, and Cloudflare Turnstile on the public write forms, each behind a dev/no-creds fallback so it ships and tests now.

**Architecture:** Four small units: `lib/security/headers.ts` (header set, applied in `proxy.ts`); `lib/rate-limit/` (RateLimiter interface + in-process MemoryLimiter + Upstash adapter + `enforceRateLimit` helper); `lib/turnstile.ts` (server verify with dev bypass) + `components/security/TurnstileWidget.tsx` (client widget). Wired into `placeOrder`, `/api/waitlist`, and the admin magic-link login.

**Tech Stack:** Next.js 16 middleware (`src/proxy.ts`), Server Actions, `@upstash/ratelimit` + `@upstash/redis` (optional, env-gated), Cloudflare Turnstile (fetch), Zod, Vitest. Bun for all except `next build` (Node).

**Reference:** Spec [docs/superpowers/specs/2026-06-27-rb-shop-security-hardening-design.md](../specs/2026-06-27-rb-shop-security-hardening-design.md).

---

## Conventions (carry-over)

Branch `develop`, commit per task. `import * as z from 'zod'`. Run WSL commands via a script file in `\\wsl.localhost\Ubuntu\tmp\<name>.sh` then `wsl -d Ubuntu -- bash -lc "bash /tmp/<name>.sh"` (Windows PATH parens break inline `$PATH`; the script sets `export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"`). A `/tmp/vitest.sh` helper exists (`bun run vitest run "$@"`). git runs in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Build uses Node: `node ./node_modules/next/dist/bin/next build`. Every commit body ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File structure built by this plan

```
src/
  lib/
    env.ts                      (modify — add optional Upstash/Turnstile keys)
    security/headers.ts         (new — securityHeaders())
    rate-limit/
      types.ts                  (new — RateLimiter, RateResult)
      memory.ts                 (new — MemoryLimiter, TDD)
      upstash.ts                (new — UpstashLimiter)
      index.ts                  (new — getLimiter + enforceRateLimit + clientIp)
    turnstile.ts                (new — verifyTurnstile, TDD)
  components/security/TurnstileWidget.tsx   (new — client widget)
  proxy.ts                      (modify — apply security headers)
  server/actions/orders.ts      (modify — rate-limit + Turnstile in placeOrder)
  server/actions/auth.ts        (modify — rate-limit + Turnstile in requestMagicLink)
  app/api/waitlist/route.ts     (modify — rate-limit + Turnstile)
  components/checkout/CheckoutForm.tsx  (modify — widget + token)
  components/shop/WaitlistButton.tsx    (modify — widget + token)
  app/admin/login/page.tsx      (modify — widget + token)
tests/unit/lib/
  security-headers.test.ts
  rate-limit-memory.test.ts
  turnstile.test.ts
```

---

## Task 1: Env vars

**Files:** Modify `src/lib/env.ts`; modify `.env.example`.

- [ ] **Step 1: Add optional keys to the Zod schema.** In `src/lib/env.ts`, the `EnvSchema` object currently ends after `SUPABASE_SERVICE_ROLE_KEY`. Add these fields inside the `z.object({...})` (after the service-role line):

```ts
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2: Document in `.env.example`.** Append:

```
# Rate limiting (Upstash Redis). Omit both to use the in-memory dev fallback.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cloudflare Turnstile. Omit secret to bypass verification in dev; omit public key to hide the widget.
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

- [ ] **Step 3: Typecheck + commit.** Run tsc (see Conventions). `.env.example` is gitignored — do NOT `git add` it.

```bash
git add src/lib/env.ts
git commit -m "chore(security): optional Upstash + Turnstile env vars"
```

---

## Task 2: Security headers module (TDD)

**Files:** Create `src/lib/security/headers.ts`, `tests/unit/lib/security-headers.test.ts`.

- [ ] **Step 1: Write the failing test.**

```ts
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
```

- [ ] **Step 2: Run the test, verify it FAILS** (cannot resolve `@/lib/security/headers`). Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/security-headers.test.ts"`.

- [ ] **Step 3: Write the implementation.**

```ts
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
```

- [ ] **Step 4: Run the test, verify it PASSES** (3 tests). Then biome: `bun run biome check --write src/lib/security/headers.ts tests/unit/lib/security-headers.test.ts`.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/security/headers.ts tests/unit/lib/security-headers.test.ts
git commit -m "feat(security): security headers + pragmatic CSP (TDD)"
```

---

## Task 3: Apply headers in proxy.ts

**Files:** Modify `src/proxy.ts`.

The current file forwards `x-pathname` and either returns `NextResponse.next` (admin/api) or `intlMiddleware(request)`. Set the security headers on whichever response is returned.

- [ ] **Step 1: Rewrite `src/proxy.ts`.** Replace its full contents with:

```ts
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
```

- [ ] **Step 2: Typecheck + dev smoke + build.** Write `\\wsl.localhost\Ubuntu\tmp\p6-t3.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun run tsc --noEmit 2>&1 | tail -6 && echo TSC_OK
bun run biome check --write src/proxy.ts 2>&1 | tail -3
node ./node_modules/next/dist/bin/next build 2>&1 | grep -vE 'unique .key. prop|warning-keys|top-level render' | grep -E "Compiled|error|Error|Failed" | tail -6
```

Run it. Expected: TSC_OK, biome clean, `Compiled successfully`.

- [ ] **Step 3: Commit.**

```bash
git add src/proxy.ts
git commit -m "feat(security): apply security headers to all responses in proxy"
```

---

## Task 4: Rate-limit types + MemoryLimiter (TDD)

**Files:** Create `src/lib/rate-limit/types.ts`, `src/lib/rate-limit/memory.ts`, `tests/unit/lib/rate-limit-memory.test.ts`.

- [ ] **Step 1: Write the types.** `src/lib/rate-limit/types.ts`:

```ts
export interface RateResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateResult>;
}
```

- [ ] **Step 2: Write the failing test.** `tests/unit/lib/rate-limit-memory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MemoryLimiter } from '@/lib/rate-limit/memory';

describe('MemoryLimiter', () => {
  it('allows up to max requests in a window, then blocks', async () => {
    const l = new MemoryLimiter(2, 1000, () => 1000);
    expect((await l.limit('a')).ok).toBe(true);
    expect((await l.limit('a')).ok).toBe(true);
    const third = await l.limit('a');
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('resets after the window elapses', async () => {
    let now = 1000;
    const l = new MemoryLimiter(1, 1000, () => now);
    expect((await l.limit('a')).ok).toBe(true);
    expect((await l.limit('a')).ok).toBe(false);
    now = 2000; // window elapsed
    expect((await l.limit('a')).ok).toBe(true);
  });

  it('tracks keys independently', async () => {
    const l = new MemoryLimiter(1, 1000, () => 1000);
    expect((await l.limit('a')).ok).toBe(true);
    expect((await l.limit('b')).ok).toBe(true);
    expect((await l.limit('a')).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test, verify it FAILS** (cannot resolve `@/lib/rate-limit/memory`).

- [ ] **Step 4: Write the implementation.** `src/lib/rate-limit/memory.ts`:

```ts
import type { RateLimiter, RateResult } from './types';

/** In-process fixed-window limiter. Single-instance only (dev / fallback). */
export class MemoryLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async limit(key: string): Promise<RateResult> {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || t >= entry.resetAt) {
      entry = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    return {
      ok: entry.count <= this.max,
      remaining: Math.max(0, this.max - entry.count),
      resetAt: entry.resetAt,
    };
  }
}
```

- [ ] **Step 5: Run the test, verify it PASSES** (3 tests). biome the three files.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/rate-limit/types.ts src/lib/rate-limit/memory.ts tests/unit/lib/rate-limit-memory.test.ts
git commit -m "feat(security): rate-limit interface + in-memory limiter (TDD)"
```

---

## Task 5: Upstash adapter + factory + helper

**Files:** Modify `package.json` (add `@upstash/ratelimit` `@upstash/redis`); create `src/lib/rate-limit/upstash.ts`, `src/lib/rate-limit/index.ts`.

- [ ] **Step 1: Install deps.** Write `\\wsl.localhost\Ubuntu\tmp\p6-t5.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun add @upstash/ratelimit @upstash/redis 2>&1 | tail -6
```

Run it. Expected: `installed @upstash/ratelimit@...` and `@upstash/redis@...`.

- [ ] **Step 2: Write the Upstash adapter.** `src/lib/rate-limit/upstash.ts`:

```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { RateLimiter, RateResult } from './types';

/** Distributed sliding-window limiter backed by Upstash Redis. */
export class UpstashLimiter implements RateLimiter {
  private rl: Ratelimit;

  constructor(url: string, token: string, max: number, windowMs: number) {
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    this.rl = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(max, `${seconds} s`),
      prefix: 'rb_rl',
    });
  }

  async limit(key: string): Promise<RateResult> {
    const r = await this.rl.limit(key);
    return { ok: r.success, remaining: r.remaining, resetAt: r.reset };
  }
}
```

- [ ] **Step 3: Write the factory + helper.** `src/lib/rate-limit/index.ts`:

```ts
import 'server-only';
import { headers } from 'next/headers';
import { MemoryLimiter } from './memory';
import type { RateLimiter, RateResult } from './types';
import { UpstashLimiter } from './upstash';

export type { RateResult } from './types';

const registry = new Map<string, RateLimiter>();

function limiterFor(bucket: string, max: number, windowMs: number): RateLimiter {
  const id = `${bucket}:${max}:${windowMs}`;
  const existing = registry.get(id);
  if (existing) return existing;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const limiter: RateLimiter =
    url && token ? new UpstashLimiter(url, token, max, windowMs) : new MemoryLimiter(max, windowMs);
  registry.set(id, limiter);
  return limiter;
}

/** Run a rate-limit check. Fails OPEN (ok:true) if the backend throws — limiting
 *  is a mitigation, not a hard gate, and must never block a legitimate request. */
export async function enforceRateLimit(
  bucket: string,
  key: string,
  opts: { max: number; windowMs: number },
): Promise<RateResult> {
  try {
    return await limiterFor(bucket, opts.max, opts.windowMs).limit(`${bucket}:${key}`);
  } catch (err) {
    console.error('[rate-limit] backend error, failing open', err);
    return { ok: true, remaining: 0, resetAt: Date.now() };
  }
}

/** Best-effort client IP from the forwarded headers (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
```

- [ ] **Step 4: Typecheck + lint.** Run tsc + `bun run biome check --write src/lib/rate-limit/`. Expected: no errors. `UpstashLimiter` is statically imported but only constructed when the Upstash env vars are set; the module is `server-only` so the dep never reaches the client bundle.

- [ ] **Step 5: Commit.**

```bash
git add package.json bun.lock src/lib/rate-limit/upstash.ts src/lib/rate-limit/index.ts
git commit -m "feat(security): Upstash limiter + factory + enforceRateLimit/clientIp helper"
```

---

## Task 6: Turnstile verify (TDD)

**Files:** Create `src/lib/turnstile.ts`, `tests/unit/lib/turnstile.test.ts`.

- [ ] **Step 1: Write the failing test.**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { verifyTurnstile } = await import('@/lib/turnstile');

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('verifyTurnstile', () => {
  it('bypasses (returns true) with no secret configured and does not call fetch', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyTurnstile('tok')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when Cloudflare reports success', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }))));
    expect(await verifyTurnstile('tok', '1.2.3.4')).toBe(true);
  });

  it('returns false when Cloudflare reports failure', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }))));
    expect(await verifyTurnstile('tok')).toBe(false);
  });

  it('returns false (fails closed) when the request throws', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network');
    }));
    expect(await verifyTurnstile('tok')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS** (cannot resolve `@/lib/turnstile`).

- [ ] **Step 3: Write the implementation.** `src/lib/turnstile.ts`:

```ts
import 'server-only';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Verify a Turnstile token. With no secret configured this is a dev bypass
 *  (returns true). With a secret, network/verify failures fail CLOSED (false). */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (err) {
    console.error('[turnstile] verify failed', err);
    return false;
  }
}
```

- [ ] **Step 4: Run the test, verify it PASSES** (4 tests). biome both files.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/turnstile.ts tests/unit/lib/turnstile.test.ts
git commit -m "feat(security): Turnstile server verify with dev bypass (TDD)"
```

---

## Task 7: TurnstileWidget client component

**Files:** Create `src/components/security/TurnstileWidget.tsx`.

- [ ] **Step 1: Write the component.**

```tsx
'use client';

import { useEffect, useRef } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string;
    };
  }
}

/** Renders the Turnstile widget and reports the solved token. Renders nothing
 *  when no public site key is configured (local dev). */
export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    const el = ref.current;

    function render() {
      if (window.turnstile && el) {
        window.turnstile.render(el, { sitekey: SITE_KEY as string, callback: onToken });
      }
    }

    if (window.turnstile) {
      render();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', render);
      return () => existing.removeEventListener('load', render);
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', render);
    document.head.appendChild(script);
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="my-2" />;
}
```

- [ ] **Step 2: Typecheck + lint.** Run tsc + `bun run biome check --write src/components/security/TurnstileWidget.tsx`. Expected: clean.

- [ ] **Step 3: Commit.**

```bash
git add src/components/security/TurnstileWidget.tsx
git commit -m "feat(security): TurnstileWidget client component (no-op without site key)"
```

---

## Task 8: Harden placeOrder (rate-limit + Turnstile) + checkout form

**Files:** Modify `src/server/actions/orders.ts`, `src/components/checkout/CheckoutForm.tsx`.

- [ ] **Step 1: Add the token to the input + guards in `placeOrder`.** In `src/server/actions/orders.ts`:
  1. Add imports at the top (with the other imports):
     ```ts
     import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
     import { verifyTurnstile } from '@/lib/turnstile';
     ```
  2. In the `PlaceOrderInput` Zod object, add a field: `turnstileToken: z.string().optional(),`
  3. At the very start of the `placeOrder` function body (before parsing/work begins), add:
     ```ts
     const ip = await clientIp();
     const rl = await enforceRateLimit('checkout', ip, { max: 8, windowMs: 60_000 });
     if (!rl.ok) return { error: 'Too many checkout attempts — please wait a minute.' };
     if (!(await verifyTurnstile(raw.turnstileToken ?? '', ip))) {
       return { error: 'Verification failed — please retry.' };
     }
     ```
     (Place these after the function signature line `export async function placeOrder(raw: PlaceOrderInputT) {` and before the existing first statement. `raw` is the argument name — confirm by reading the file first.)

- [ ] **Step 2: Wire the widget into the checkout form.** In `src/components/checkout/CheckoutForm.tsx`:
  1. Import: `import { TurnstileWidget } from '@/components/security/TurnstileWidget';`
  2. Add token state near the other `useState`s: `const [token, setToken] = useState('');`
  3. Render the widget inside the `<form>` just above the submit button: `<TurnstileWidget onToken={setToken} />`
  4. In the `placeOrder({...})` call inside `onSubmit`, add `turnstileToken: token,` to the argument object.

- [ ] **Step 2b: Read both files first** with the Read tool to place these edits precisely (the exact surrounding lines vary). Keep all existing behavior; only add the four pieces above per file.

- [ ] **Step 3: Typecheck + build.** Run tsc + biome on both files + `next build`. Expected: clean, `Compiled successfully`. The mock checkout still works with no Turnstile keys (verify returns true; widget renders nothing).

- [ ] **Step 4: Commit.**

```bash
git add src/server/actions/orders.ts src/components/checkout/CheckoutForm.tsx
git commit -m "feat(security): rate-limit + Turnstile on checkout"
```

---

## Task 9: Harden /api/waitlist + waitlist button

**Files:** Modify `src/app/api/waitlist/route.ts`, `src/components/shop/WaitlistButton.tsx`.

- [ ] **Step 1: Guards in the route.** In `src/app/api/waitlist/route.ts`:
  1. Add imports:
     ```ts
     import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
     import { verifyTurnstile } from '@/lib/turnstile';
     ```
  2. Add `turnstileToken: z.string().optional()` to the `Body` Zod object.
  3. After parsing `Body` succeeds and before the DB insert, add:
     ```ts
     const ip = await clientIp();
     const rl = await enforceRateLimit('waitlist', ip, { max: 5, windowMs: 60_000 });
     if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
     if (!(await verifyTurnstile(parsed.data.turnstileToken ?? '', ip))) {
       return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
     }
     ```
     (Use the actual parsed-variable name from the file — read it first; it destructures `parsed.data` for `variantId/email/locale`.)

- [ ] **Step 2: Wire the widget into `WaitlistButton`.** In `src/components/shop/WaitlistButton.tsx`:
  1. Import `TurnstileWidget`.
  2. Add `const [token, setToken] = useState('');`
  3. Render `<TurnstileWidget onToken={setToken} />` inside the form, above the submit button.
  4. Add `turnstileToken: token` to the JSON body sent to `/api/waitlist`.
  Read the file first to place edits precisely; preserve the existing states ('idle'|'pending'|'done'|'error').

- [ ] **Step 3: Typecheck + build.** tsc + biome both files + `next build`. Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add src/app/api/waitlist/route.ts src/components/shop/WaitlistButton.tsx
git commit -m "feat(security): rate-limit + Turnstile on waitlist join"
```

---

## Task 10: Harden admin magic-link login

**Files:** Modify `src/server/actions/auth.ts`, `src/app/admin/login/page.tsx`.

- [ ] **Step 1: Guards in `requestMagicLink`.** In `src/server/actions/auth.ts`, `requestMagicLink(formData)` currently reads `email` and calls `signInWithOtp`. Add:
  1. Imports:
     ```ts
     import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
     import { verifyTurnstile } from '@/lib/turnstile';
     ```
  2. After computing `email` (and its empty check), before `signInWithOtp`:
     ```ts
     const ip = await clientIp();
     const token = String(formData.get('turnstileToken') ?? '');
     const byIp = await enforceRateLimit('login-ip', ip, { max: 5, windowMs: 600_000 });
     const byEmail = await enforceRateLimit('login-email', email.toLowerCase(), { max: 5, windowMs: 600_000 });
     if (!byIp.ok || !byEmail.ok) return { error: 'Too many sign-in attempts — please wait.' };
     if (!(await verifyTurnstile(token, ip))) return { error: 'Verification failed — please retry.' };
     ```
  Read the file first; preserve the existing return shape (`{ error }` / `{ ok: ... }`).

- [ ] **Step 2: Wire the widget into the login form.** In `src/app/admin/login/page.tsx`:
  1. Import `TurnstileWidget`.
  2. Add `const [token, setToken] = useState('');`
  3. Render `<TurnstileWidget onToken={setToken} />` inside the form above the submit Button.
  4. The form uses `action={async (fd) => { ... requestMagicLink(fd) }}` with FormData. Add a hidden input so the token rides along in the FormData: `<input type="hidden" name="turnstileToken" value={token} />`.

- [ ] **Step 3: Typecheck + build.** tsc + biome both files + `next build`. Expected: clean. Local login still works (no keys → verify true, widget hidden).

- [ ] **Step 4: Commit.**

```bash
git add src/server/actions/auth.ts src/app/admin/login/page.tsx
git commit -m "feat(security): rate-limit + Turnstile on admin magic-link login"
```

---

## Task 11: README + final gate

**Files:** Modify `README.md`.

- [ ] **Step 1: Add a Security section** to `README.md` (after the "Google Sheets sync" section, before "Build runtime split"):

```markdown
## Security hardening

- **Headers/CSP:** `src/proxy.ts` sets HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a
  pragmatic CSP (`src/lib/security/headers.ts`). Dev mode allows the HMR
  websocket; production is tighter.
- **Rate limiting:** `enforceRateLimit` (`src/lib/rate-limit/`) guards checkout,
  waitlist, and login. Uses Upstash Redis when `UPSTASH_REDIS_REST_URL/TOKEN`
  are set, else an in-memory dev fallback. Fails open if the backend errors.
- **Turnstile:** `verifyTurnstile` gates the same three forms. With no
  `TURNSTILE_SECRET_KEY` it's a dev bypass; the `<TurnstileWidget>` renders
  nothing without `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Set both for production.
```

- [ ] **Step 2: Run the full gate.** Write `\\wsl.localhost\Ubuntu\tmp\p6-gate.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
echo "=== typecheck ==="; bun run tsc --noEmit 2>&1 | tail -6 && echo TSC_OK
echo "=== lint ==="; bun run biome check . 2>&1 | tail -4
echo "=== tests ==="; bun run vitest run 2>&1 | tail -8
echo "=== build ==="; node ./node_modules/next/dist/bin/next build 2>&1 | grep -vE 'unique .key. prop|warning-keys|top-level render' | grep -E "Compiled|error|Error|Failed" | tail -8
```

Run it. Expected: typecheck clean; biome clean; ALL tests pass (incl. new security-headers, rate-limit-memory, turnstile suites); `Compiled successfully`. If anything fails, fix and re-run until green.

- [ ] **Step 3: Commit.**

```bash
git add README.md
git commit -m "docs: security hardening section; Plan 6a complete"
```

---

## Out of scope (later)

| Concern | Plan |
|---|---|
| Full nonce-based CSP (drop `'unsafe-inline'`) | 6a-2 |
| Step-up auth for destructive admin actions | 6a-2 |
| Webhook replay-hardening beyond row idempotency | 6a-2 |
| Real FeelFreePay/PSP adapter | 6c |
| Production deploy | 6d |
