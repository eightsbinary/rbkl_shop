# rb_shop — Plan 6a-2 design: Security hardening follow-ups

**Status:** Design approved 2026-06-28. Ready for plan.
**Parent specs:** [2026-06-27-rb-shop-security-hardening-design.md](2026-06-27-rb-shop-security-hardening-design.md) (Plan 6a) — this picks up its three deferred items.

## Goal

Close the three security gaps deferred from Plan 6a, each as an independent,
testable unit that ships now under the same constraints ($0 fixed cost, Vercel
free tier, local-dev-friendly, security non-negotiable, operational toil
minimized):

1. **Step-up auth** — a recency gate on destructive admin actions.
2. **Webhook replay hardening** — atomic, durable dedup + a freshness window.
3. **Nonce-based CSP** — drop `script-src 'unsafe-inline'` on the admin area.

## Scope

**In:**
- `requireRecentAuth` recency gate on all admin mutations (30-min window).
- `processed_webhook_events` table + atomic dedup + an `occurredAt` freshness
  window on the payment webhook.
- Per-request nonce CSP applied to `/admin` routes only; storefront keeps the
  Plan 6a pragmatic CSP.

**Out (later):** real FeelFreePay/PSP adapter (Plan 6c, parked pending creator
confirmation); production deploy (Plan 6d); E2E tests; storefront nonce CSP
(revisit if traffic/threat model justifies giving up static caching); dropping
`style-src 'unsafe-inline'` (React `style={}` attributes can't be nonced).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Step-up mechanism | Recency gate via Supabase `last_sign_in_at` | No new secret/cookie infra; `last_sign_in_at` tracks interactive sign-in, not token refresh |
| Step-up scope + window | All mutations, 30 min, uniform | Nothing per-action to maintain; ≈ re-login once per work session |
| Webhook dedup | DB `unique(provider, event_id)` insert, fail on `23505` | Atomic — also fixes the current racy read-then-check (concurrent double-decrement) |
| Webhook freshness | Reject events older than 5 min via `occurredAt` | Mitigates delayed-capture replay; provider-agnostic contract |
| CSP scope | Nonce CSP on `/admin` only | Admin is already dynamic + auth-gated (the hijack target); storefront stays statically cacheable, protecting the $0/free-tier constraint |
| `style-src` | Keep `'unsafe-inline'` | Inline style attributes can't be nonced; far lower risk than script injection |

## Architecture

Three small units, each with one responsibility and a clear interface.

```
src/
  db/
    auth.ts            + StepUpRequiredError, requireRecentAuth(client, windowMs) (modify)
  lib/
    security/
      headers.ts       securityHeaders() gains optional `nonce`; nonce mode drops script 'unsafe-inline' (modify)
    webhook/
      freshness.ts     isFresh(occurredAt, now, windowMs): boolean — pure (TDD)
  proxy.ts             generate per-request nonce; nonce CSP on /admin branch only (modify)
  server/actions/
    ship-order.ts      + requireRecentAuth (modify)
    products.ts        + requireRecentAuth in saveProduct + archiveProduct (modify)
    discounts.ts       + requireRecentAuth in createDiscount + updateDiscount (modify)
    sync-sheets.ts     + requireRecentAuth (modify)
  domain/payment/
    ChargeInput.ts     VerifiedEvent gains `occurredAt: number` (epoch ms) (modify)
    adapters/MockProvider.ts   stamp occurredAt = Date.now() (modify)
  app/api/payments/notify/[provider]/route.ts   atomic dedup insert + freshness check (modify)
  components/admin/
    StepUpPrompt.tsx   client: shown when an action returns stepUpRequired; re-sends magic link (new)
supabase/migrations/
  <ts>_processed_webhook_events.sql   new table + unique constraint + RLS (new)
tests/unit/
  db/require-recent-auth.test.ts
  lib/webhook-freshness.test.ts
  lib/security-headers.test.ts   (extend: nonce mode)
```

### 1. Step-up auth (recency gate)

```ts
export class StepUpRequiredError extends Error { /* name = 'StepUpRequiredError' */ }

/** Throws StepUpRequiredError unless the user interactively signed in within
 *  windowMs. Uses Supabase last_sign_in_at, which is NOT bumped by token refresh. */
export async function requireRecentAuth(client: Client, windowMs: number): Promise<void>;
```

- Reads `client.auth.getUser()`. If no user, or `user.last_sign_in_at` is missing,
  or `now - Date.parse(last_sign_in_at) > windowMs` → throw `StepUpRequiredError`.
- A shared constant `STEP_UP_WINDOW_MS = 30 * 60_000`.
- Each mutation calls `await requireRecentAuth(supa, STEP_UP_WINDOW_MS)` immediately
  after `await requireOwnerOrDev(supa)`. Mutations covered: `shipOrder`,
  `saveProduct`, `archiveProduct`, `createDiscount`, `updateDiscount`, `syncSheets`.
- **Return shape:** actions catch `StepUpRequiredError` (or it surfaces from the
  helper) and return `{ error: 'stepUpRequired' }` — a sentinel the client maps to
  the re-auth prompt, distinct from validation errors. (`syncSheets` returns its
  own result union; add the sentinel there too.)
- **UX:** `<StepUpPrompt>` renders when an action result is `stepUpRequired`. It
  reuses `requestMagicLink` (already rate-limited + Turnstile-gated) to email a
  fresh link to the current admin; clicking it bumps `last_sign_in_at`, so the
  retried action passes. No new auth surface.

### 2. Webhook replay hardening

**Migration — `processed_webhook_events`:**

```sql
create table public.processed_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  order_id uuid references public.orders(id),
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.processed_webhook_events enable row level security;
-- No policies: service-role bypasses RLS; anon/auth get no access.
```

**Freshness (pure, TDD):**

```ts
/** True if occurredAt is within windowMs of now (past or future clock skew). */
export function isFresh(occurredAt: number, now: number, windowMs: number): boolean {
  return Math.abs(now - occurredAt) <= windowMs;
}
```

**Webhook route changes** (`/api/payments/notify/[provider]`), after signature
verify and order lookup, before any mutation:

1. **Freshness:** `if (!isFresh(event.occurredAt, Date.now(), 5*60_000)) return 400 'Stale event'`.
2. **Atomic dedup:** `insert into processed_webhook_events (provider, event_id, order_id)`.
   On `23505` (unique violation) → return `{ ok: true, dedup: true }` and do nothing
   else. On success → proceed with the existing paid/failed handling.
   This replaces the `order.last_event_id === event.eventId` early-return as the
   authoritative dedup (keep writing `last_event_id` for display, but it's no longer
   load-bearing). Atomicity removes the double-decrement race.

`VerifiedEvent` gains `occurredAt: number` (epoch ms); `MockProvider.verifyNotification`
sets it to `Date.now()` at emit time (or echoes a timestamp from its signed payload).

### 3. Nonce-based CSP (admin only)

- `securityHeaders({ isDev, supabaseHost, nonce? })`. When `nonce` is provided:
  `script-src 'self' 'nonce-<nonce>' https://challenges.cloudflare.com`
  (+ `'unsafe-eval'` in dev) — **no `'unsafe-inline'`**. When absent (storefront):
  unchanged Plan 6a pragmatic policy. `style-src` keeps `'unsafe-inline'` in both.
  No `'strict-dynamic'`, so the `https://challenges.cloudflare.com` host allowlist
  still admits Turnstile's dynamically injected script.
- `proxy.ts`: on the `/admin` branch only, generate a nonce
  (`crypto.getRandomValues` → base64), set the nonce'd CSP on **request** headers
  (so Next applies it to its bootstrap scripts) and on the response. Storefront
  branch is unchanged. Nonce opts admin routes into dynamic rendering — which they
  already are (auth-gated), so no caching is lost.
  - **`/api` branch:** API routes render no HTML/scripts, so they keep the
    **storefront (non-nonce)** header set — no per-request nonce work. Nonce mode
    is for `/admin` page routes only.

## Error handling

- **Step-up:** `StepUpRequiredError` is an expected control-flow signal, not a
  500 — mapped to `{ error: 'stepUpRequired' }`. A Supabase `getUser` failure
  (no session) also yields step-up-required (fail closed — re-auth).
- **Webhook freshness/dedup:** stale → 400; duplicate → 200 `{ dedup: true }`
  (idempotent success, not an error). A non-`23505` insert error → 500 and do not
  process (fail closed — never act on an unrecorded event).
- **CSP nonce generation:** pure crypto, cannot fail; if the admin branch somehow
  lacks a nonce it falls back to the pragmatic policy (degrade, not break).
- **Missing env:** unchanged from 6a — every absence resolves to a safe fallback.

## Testing

- **require-recent-auth** (unit): injected user + clock — fresh sign-in passes;
  stale throws; missing `last_sign_in_at` throws; no user throws.
- **webhook-freshness** (unit, TDD): within window true; past/future beyond window
  false; boundary inclusive.
- **security-headers** (unit, extend): nonce mode includes `'nonce-…'` and omits
  `'unsafe-inline'` from `script-src`; non-nonce mode unchanged; `style-src` keeps
  `'unsafe-inline'` in both.
- **Atomic dedup, proxy nonce wiring, StepUpPrompt** — verified by build + manual
  gate (DB unique constraint, real `/admin` response headers, re-auth round trip).

## Out of scope (later)

| Concern | Plan |
|---|---|
| Storefront nonce CSP (give up static caching) | later, traffic-driven |
| Drop `style-src 'unsafe-inline'` | later |
| Real FeelFreePay/PSP adapter + its signed `occurredAt` | 6c (parked) |
| E2E tests over the hardened flows | 6b/E2E |
| Production deploy | 6d |
