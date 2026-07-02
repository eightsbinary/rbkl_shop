# rb_shop — Plan 6a design: Security hardening

**Status:** Design approved 2026-06-27. Ready for plan.
**Parent spec:** [2026-06-26-rb-shop-design.md](2026-06-26-rb-shop-design.md) §9 (Security).

## Goal

Make the app safe to deploy: ship strong HTTP security headers + a pragmatic
Content-Security-Policy, rate-limit the sensitive endpoints, and gate the public
write forms with Cloudflare Turnstile. Every external service (Upstash, Turnstile)
is behind an abstraction with a **dev/no-creds fallback**, so the code ships and
tests now and real keys plug in later via env vars — preserving the $0-cost,
local-dev-friendly constraints.

## Scope

**In:** security headers + CSP; rate limiting (abstraction + in-memory fallback +
Upstash adapter); Turnstile (server verify + client widget) on checkout, waitlist,
and admin login.

**Deferred (Plan 6a-2 / later):** session step-up auth for destructive admin
actions; webhook replay-hardening beyond the existing idempotency; real PSP/FFP
adapter (Plan 6c); production deploy (Plan 6d).

## Locked decisions

| Decision | Choice |
|---|---|
| CSP strictness | Pragmatic first — strong headers + a CSP that allows what Next 16 + Tailwind + next-intl + Turnstile + Supabase need; full nonce-based CSP deferred |
| Rate-limit architecture | `RateLimiter` interface + `MemoryLimiter` (in-process, TDD) + `UpstashLimiter`; factory picks Upstash when env present, else memory |
| Rate-limit targets | `placeOrder` (per-IP), `/api/waitlist` (per-IP), admin magic-link login (per-email + per-IP) |
| Turnstile dev behavior | `verifyTurnstile` returns `true` when `TURNSTILE_SECRET_KEY` is unset; widget renders nothing when the public site key is unset |
| Turnstile targets | checkout form, waitlist form, admin login form |
| Config | All keys optional env vars; absence = safe local-dev fallback |

## Architecture

Four small, independent units, each with one responsibility and a clear interface.

```
src/
  lib/
    security/
      headers.ts        securityHeaders(): Record<string,string> — the header set + CSP
    rate-limit/
      types.ts          RateLimiter interface + RateResult type
      memory.ts         MemoryLimiter — pure-ish sliding window over an in-process Map (TDD)
      upstash.ts        UpstashLimiter — wraps @upstash/ratelimit when env present
      index.ts          getRateLimiter() factory + enforceRateLimit(name,key,opts) helper
    turnstile.ts        verifyTurnstile(token, ip) — Cloudflare siteverify + dev bypass (TDD)
  components/
    security/
      TurnstileWidget.tsx   client widget; renders null when no public site key
  proxy.ts            apply securityHeaders() to every response (modify)
  lib/env.ts          add optional Upstash/Turnstile keys (modify)
tests/unit/lib/
  security-headers.test.ts
  rate-limit-memory.test.ts
  turnstile.test.ts
```

### 1. Security headers + CSP

`securityHeaders()` returns a static header map:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` (pragmatic): `default-src 'self'`; `img-src 'self' data: blob: <SUPABASE_HOST>`; `connect-src 'self' <SUPABASE_HOST> https://challenges.cloudflare.com`; `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`; `style-src 'self' 'unsafe-inline'`; `frame-src https://challenges.cloudflare.com`; `font-src 'self' data:`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`.

`'unsafe-inline'` on script/style is the deliberate pragmatic tradeoff (Next 16's
hydration bootstrap + inline `style={}` attributes). It is documented as such and
slated to be tightened to nonces in a follow-up. The Supabase host is derived from
`NEXT_PUBLIC_SUPABASE_URL`.

**Dev vs prod:** in development the Next dev server uses a websocket for HMR, which
a strict `connect-src` would block. So `securityHeaders()` takes the environment
into account: in `development` it adds `ws:` / `wss:` (and `'unsafe-eval'` to
`script-src`, which Next dev needs) to keep HMR working; in production those are
omitted. The non-CSP headers are identical in both. This keeps `bun run dev`
functional while production stays tight.

Applied in `src/proxy.ts`: after computing the response (intl branch or the
admin/api `NextResponse.next` branch), set each header on `response.headers`
before returning. One helper call, both branches.

### 2. Rate limiting

```ts
export interface RateResult { ok: boolean; remaining: number; resetAt: number }
export interface RateLimiter { limit(key: string): Promise<RateResult> }
```

- **MemoryLimiter** — fixed-window counter keyed by `key` over an in-process `Map`,
  window + max configurable. Pure logic around an injected clock so it's
  deterministic to test. Suitable for single-instance dev; documented as
  non-distributed.
- **UpstashLimiter** — wraps `@upstash/ratelimit` + `@upstash/redis` sliding window,
  constructed only when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` exist.
- **getRateLimiter(name, opts)** — returns an Upstash limiter when env is present,
  else a shared MemoryLimiter. **enforceRateLimit(name, key, opts)** runs `.limit()`
  and returns `RateResult`.

Client IP comes from `headers().get('x-forwarded-for')?.split(',')[0]` (Vercel
sets it), falling back to `'unknown'`. Integration:
- `placeOrder` server action: key `checkout:<ip>` — on `!ok` return `{ error: 'Too many attempts, please wait a moment.' }`.
- `/api/waitlist` route: key `waitlist:<ip>` — on `!ok` return `429`.
- admin login action: keys `login:<emailLower>` and `login:<ip>` — on `!ok` return an error.

### 3. Turnstile

- `verifyTurnstile(token, ip?)`: if `TURNSTILE_SECRET_KEY` unset → return `true`
  (dev bypass, logged once). Else POST to
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` with secret + token
  (+ ip) and return `json.success === true`.
- `<TurnstileWidget onToken>`: if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset → render
  `null` (dev). Else load the Turnstile script and render the widget, calling
  `onToken` with the solved token.
- Wiring: checkout form, waitlist form, and admin login each render the widget,
  carry the token in their submit payload, and the server (`placeOrder`,
  `/api/waitlist`, login action) calls `verifyTurnstile` first; on failure returns a
  validation error / 400 before doing any work.

### 4. Env

Extend `EnvSchema` in `src/lib/env.ts` with optional:
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SECRET_KEY`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (all `.optional()`). `.env.example` documents them.

## Error handling

- **Rate-limit backend error** (Upstash unreachable): fail **open** for the fan
  (allow the request) but log — never block a legitimate checkout because Redis
  blipped. Rate limiting is a mitigation, not a gate.
- **Turnstile verify error / network failure**: fail **closed** for the form
  (treat as not-verified) — but only when a secret key is configured; with no key
  it's a dev bypass.
- **Missing env**: no crash — every absence resolves to the documented fallback.
- **CSP breakage**: pragmatic policy chosen specifically to avoid blocking app
  resources; verified by loading every route type in the manual gate.

## Testing

- **security-headers** (unit): asserts the header map contains each required header
  and that the CSP string includes the key directives + the Supabase host.
- **rate-limit-memory** (unit, TDD): allows up to `max` within a window; blocks the
  next; resets after the window via the injected clock; independent keys don't
  interfere.
- **turnstile** (unit, TDD): no secret → `true` without calling fetch; secret +
  mocked `{success:true}` → `true`; `{success:false}` → `false`; network throw →
  `false`.
- Proxy header application, the Upstash adapter, and the widget are verified by the
  build + manual gate (not unit-mocked).

## Out of scope (later)

| Concern | Plan |
|---|---|
| Full nonce-based CSP (drop `'unsafe-inline'`) | 6a-2 |
| Session step-up auth for destructive admin actions | 6a-2 |
| Webhook replay-hardening beyond row-level idempotency | 6a-2 |
| Real FeelFreePay/PSP adapter | 6c |
| Production deploy (Vercel + prod Supabase + real keys) | 6d |
