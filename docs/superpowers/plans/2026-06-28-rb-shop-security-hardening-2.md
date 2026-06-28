# Plan 6a-2 — Security hardening follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three security gaps deferred from Plan 6a — a recency-based step-up gate on destructive admin actions, atomic/durable webhook replay hardening with a freshness window, and a nonce-based CSP on the admin area.

**Architecture:** Three independent units. (1) `requireRecentAuth`/`stepUpGuard` in `src/db/auth.ts` gate the six admin mutations using Supabase `last_sign_in_at`; a `<StepUpPrompt>` re-sends a magic link. (2) A `processed_webhook_events` table + a pure `isFresh()` make the payment webhook replay-safe and fix a concurrency race. (3) `securityHeaders()` gains a `nonce` mode, generated per-request in `proxy.ts` for `/admin` only — storefront stays statically cacheable.

**Tech Stack:** Next.js 16 middleware (`src/proxy.ts`), Server Actions, Supabase (Postgres + Auth, RLS), Zod, Vitest. Bun for everything except `next build` (Node).

**Reference:** Spec [docs/superpowers/specs/2026-06-28-rb-shop-security-hardening-2-design.md](../specs/2026-06-28-rb-shop-security-hardening-2-design.md).

---

## Conventions (carry-over)

Branch `develop`, commit per task. `import * as z from 'zod'` (namespace form). Run WSL commands by writing a script to `\\wsl.localhost\Ubuntu\tmp\<name>.sh` then `wsl -d Ubuntu -- bash -lc "bash /tmp/<name>.sh"` (the script must `export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"` — Windows PATH parens break inline `$PATH`). A `/tmp/vitest.sh` helper exists (`bun run vitest run "$@"`). git runs in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Build uses Node: `node ./node_modules/next/dist/bin/next build`. Supabase CLI is `~/.local/bin/supabase`; the local stack must be up (`supabase start`, Docker WSL integration on) for migration/typegen steps. Every commit body ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Standard check script** — write to `\\wsl.localhost\Ubuntu\tmp\p6a2-check.sh` once and reuse (pass file args to scope biome):

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
echo "=== tsc ==="; bun run tsc --noEmit 2>&1 | tail -6 && echo TSC_OK
echo "=== biome ==="; bun run biome check --write "$@" 2>&1 | tail -3
```

## File structure built by this plan

```
src/
  lib/
    step-up.ts                  (new — STEP_UP_REQUIRED + STEP_UP_WINDOW_MS constants, no server imports)
    security/headers.ts         (modify — optional nonce mode)
    webhook/freshness.ts        (new — isFresh(), TDD)
  db/auth.ts                    (modify — StepUpRequiredError, requireRecentAuth, stepUpGuard)
  proxy.ts                      (modify — per-request nonce for /admin)
  server/actions/
    auth.ts                     (modify — resendStepUpLink)
    ship-order.ts               (modify — stepUpGuard)
    products.ts                 (modify — stepUpGuard ×2)
    discounts.ts                (modify — stepUpGuard ×2)
    sync-sheets.ts              (modify — stepUpGuard)
  components/admin/StepUpPrompt.tsx   (new — client re-auth prompt)
  components/admin/ShipOrderForm.tsx  (modify — render prompt)
  components/admin/ProductForm.tsx    (modify — render prompt)
  components/admin/DiscountForm.tsx   (modify — render prompt)
  components/admin/SyncPanel.tsx      (modify — render prompt)
  domain/payment/ChargeInput.ts            (modify — VerifiedEvent.occurredAt)
  domain/payment/adapters/MockProvider.ts  (unchanged logic — parses occurredAt through)
  server/actions/mock-payment.ts           (modify — stamp occurredAt)
  app/api/payments/notify/[provider]/route.ts  (modify — freshness + atomic dedup)
supabase/migrations/
  20260628001000_processed_webhook_events.sql  (new)
tests/unit/
  db/require-recent-auth.test.ts        (new)
  lib/webhook-freshness.test.ts         (new)
  lib/security-headers.test.ts          (modify — nonce cases)
tests/unit/domain/payment/mock.test.ts  (modify — occurredAt in body)
```

---

## Task 1: Step-up auth helpers (TDD)

**Files:**
- Create: `src/lib/step-up.ts`
- Modify: `src/db/auth.ts`
- Test: `tests/unit/db/require-recent-auth.test.ts`

- [ ] **Step 1: Add the shared constants.** Create `src/lib/step-up.ts`:

```ts
/** Shared step-up constants. Deliberately free of server-only imports so both
 *  server actions and client components can import them. */
export const STEP_UP_REQUIRED = 'stepUpRequired';
export const STEP_UP_WINDOW_MS = 30 * 60_000;
```

- [ ] **Step 2: Write the failing test.** Create `tests/unit/db/require-recent-auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { requireRecentAuth, StepUpRequiredError } from '@/db/auth';

type Client = Parameters<typeof requireRecentAuth>[0];

function clientWithUser(user: { last_sign_in_at?: string | null } | null): Client {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  } as unknown as Client;
}

const WINDOW = 30 * 60_000;
const NOW = 1_700_000_000_000;
const now = () => NOW;

describe('requireRecentAuth', () => {
  it('resolves when the last sign-in is within the window', async () => {
    const client = clientWithUser({ last_sign_in_at: new Date(NOW - 10 * 60_000).toISOString() });
    await expect(requireRecentAuth(client, WINDOW, now)).resolves.toBeUndefined();
  });

  it('throws StepUpRequiredError when the last sign-in is stale', async () => {
    const client = clientWithUser({ last_sign_in_at: new Date(NOW - 40 * 60_000).toISOString() });
    await expect(requireRecentAuth(client, WINDOW, now)).rejects.toBeInstanceOf(StepUpRequiredError);
  });

  it('throws when last_sign_in_at is missing', async () => {
    const client = clientWithUser({ last_sign_in_at: null });
    await expect(requireRecentAuth(client, WINDOW, now)).rejects.toBeInstanceOf(StepUpRequiredError);
  });

  it('throws when there is no user', async () => {
    const client = clientWithUser(null);
    await expect(requireRecentAuth(client, WINDOW, now)).rejects.toBeInstanceOf(StepUpRequiredError);
  });
});
```

- [ ] **Step 3: Run the test, verify it FAILS** (cannot resolve `requireRecentAuth` / `StepUpRequiredError`).

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/db/require-recent-auth.test.ts"`
Expected: FAIL — `requireRecentAuth` is not exported.

- [ ] **Step 4: Implement the helpers.** In `src/db/auth.ts`, add the import at the top (after the existing imports):

```ts
import { STEP_UP_REQUIRED, STEP_UP_WINDOW_MS } from '@/lib/step-up';
```

Then append at the end of the file:

```ts
export class StepUpRequiredError extends Error {
  constructor(message = 'Step-up authentication required') {
    super(message);
    this.name = 'StepUpRequiredError';
  }
}

/** Throws StepUpRequiredError unless the user interactively signed in within
 *  windowMs. Supabase only bumps last_sign_in_at on an actual sign-in, not on
 *  token refresh, so it is a reliable recency signal. */
export async function requireRecentAuth(
  client: Client,
  windowMs: number,
  now: () => number = () => Date.now(),
): Promise<void> {
  const { data } = await client.auth.getUser();
  const lastSignIn = data.user?.last_sign_in_at;
  if (!lastSignIn) throw new StepUpRequiredError();
  if (now() - Date.parse(lastSignIn) > windowMs) throw new StepUpRequiredError();
}

/** Action-friendly wrapper: returns the step-up sentinel result, or null when
 *  the session is recent enough. Bypassed outside production — consistent with
 *  the Turnstile / rate-limit dev fallbacks, and keeps local admin frictionless. */
export async function stepUpGuard(client: Client): Promise<{ error: string } | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  try {
    await requireRecentAuth(client, STEP_UP_WINDOW_MS);
    return null;
  } catch (e) {
    if (e instanceof StepUpRequiredError) return { error: STEP_UP_REQUIRED };
    throw e;
  }
}
```

- [ ] **Step 5: Run the test, verify it PASSES** (4 tests).

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/db/require-recent-auth.test.ts"`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint.**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/lib/step-up.ts src/db/auth.ts tests/unit/db/require-recent-auth.test.ts"`
Expected: TSC_OK, biome clean.

- [ ] **Step 7: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/lib/step-up.ts src/db/auth.ts tests/unit/db/require-recent-auth.test.ts
git commit -m "$(printf 'feat(security): recency-gate helpers for step-up auth (TDD)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Gate the six admin mutations + resendStepUpLink

**Files:**
- Modify: `src/server/actions/ship-order.ts`, `src/server/actions/products.ts`, `src/server/actions/discounts.ts`, `src/server/actions/sync-sheets.ts`, `src/server/actions/auth.ts`

- [ ] **Step 1: `ship-order.ts`.** Add to the imports:

```ts
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
```

(Replace the existing `import { requireOwnerOrDev } from '@/db/auth';`.) Then in `shipOrder`, immediately after `await requireOwnerOrDev(supa);` add:

```ts
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
```

- [ ] **Step 2: `products.ts`.** Replace the import `import { requireOwnerOrDev } from '@/db/auth';` with:

```ts
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
```

In `saveProduct`, after `await requireOwnerOrDev(supa);` add:

```ts
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
```

In `archiveProduct`, after `await requireOwnerOrDev(supa);` add the same two lines.

- [ ] **Step 3: `discounts.ts`.** Replace the import with:

```ts
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
```

In both `createDiscount` and `updateDiscount`, after `await requireOwnerOrDev(supa);` add:

```ts
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
```

- [ ] **Step 4: `sync-sheets.ts`.** Replace `import { requireDev } from '@/db/auth';` with:

```ts
import { requireDev, stepUpGuard } from '@/db/auth';
```

In `syncSheets`, after `await requireDev(supa);` add:

```ts
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
```

- [ ] **Step 5: `auth.ts` — add `resendStepUpLink`.** Append this server action to `src/server/actions/auth.ts`:

```ts
export async function resendStepUpLink(): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  const { data } = await supa.auth.getUser();
  const email = data.user?.email;
  if (!email) return { error: 'Not signed in' };

  const ip = await clientIp();
  const rl = await enforceRateLimit('stepup-ip', ip, { max: 5, windowMs: 600_000 });
  if (!rl.ok) return { error: 'Too many attempts — please wait.' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/admin` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}
```

(`createServerSupabase`, `clientIp`, `enforceRateLimit` are already imported in this file.)

- [ ] **Step 6: Typecheck + lint.**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/actions/ship-order.ts src/server/actions/products.ts src/server/actions/discounts.ts src/server/actions/sync-sheets.ts src/server/actions/auth.ts"`
Expected: TSC_OK (the `{ error: string }` sentinel is assignable to every action's result union), biome clean.

- [ ] **Step 7: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/actions/ship-order.ts src/server/actions/products.ts src/server/actions/discounts.ts src/server/actions/sync-sheets.ts src/server/actions/auth.ts
git commit -m "$(printf 'feat(security): step-up gate on all admin mutations + resendStepUpLink\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: StepUpPrompt component + wire into the four admin forms

**Files:**
- Create: `src/components/admin/StepUpPrompt.tsx`
- Modify: `src/components/admin/ShipOrderForm.tsx`, `src/components/admin/ProductForm.tsx`, `src/components/admin/DiscountForm.tsx`, `src/components/admin/SyncPanel.tsx`

- [ ] **Step 1: Create the component.** `src/components/admin/StepUpPrompt.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { resendStepUpLink } from '@/server/actions/auth';

/** Shown when an admin action returns the step-up sentinel. Re-sends a magic
 *  link to the signed-in admin; clicking it refreshes last_sign_in_at so the
 *  retried action passes the recency gate. */
export function StepUpPrompt() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <p>For your security, confirm it&apos;s you before this action.</p>
      {sent ? (
        <p className="text-success">Sign-in link sent — open it from your email, then retry.</p>
      ) : (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await resendStepUpLink();
              if ('error' in res) setError(res.error);
              else setSent(true);
            })
          }
        >
          {pending ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
      )}
      {error && <p className="text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: `ShipOrderForm.tsx`.** Add imports below the existing component imports:

```ts
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
```

Replace the line `{error && <p className="text-sm text-error">{error}</p>}` with:

```tsx
      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
```

- [ ] **Step 3: `ProductForm.tsx`.** Add the same two imports (with the other `@/components` imports), then replace the identical line `{error && <p className="text-sm text-error">{error}</p>}` with the same block from Step 2.

- [ ] **Step 4: `DiscountForm.tsx`.** Add the same two imports, then replace the identical line `{error && <p className="text-sm text-error">{error}</p>}` with the same block from Step 2.

- [ ] **Step 5: `SyncPanel.tsx`.** This form uses a `msg` object, so handle the sentinel separately. Add imports:

```ts
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
```

Add a state next to `msg`:

```ts
  const [stepUp, setStepUp] = useState(false);
```

In the click handler, change the body so it resets and branches on the sentinel. Replace:

```ts
            setMsg(null);
            const res = await syncSheets();
            if ('error' in res) setMsg({ tone: 'error', text: res.error });
            else
              setMsg({
                tone: 'ok',
                text: `Synced — ${res.applied} applied, ${res.rejected} rejected.`,
              });
```

with:

```ts
            setMsg(null);
            setStepUp(false);
            const res = await syncSheets();
            if ('error' in res) {
              if (res.error === STEP_UP_REQUIRED) setStepUp(true);
              else setMsg({ tone: 'error', text: res.error });
            } else
              setMsg({
                tone: 'ok',
                text: `Synced — ${res.applied} applied, ${res.rejected} rejected.`,
              });
```

Then render the prompt: directly after the `{msg && (...)}` block, add:

```tsx
      {stepUp && <StepUpPrompt />}
```

- [ ] **Step 6: Typecheck + lint.**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/admin/StepUpPrompt.tsx src/components/admin/ShipOrderForm.tsx src/components/admin/ProductForm.tsx src/components/admin/DiscountForm.tsx src/components/admin/SyncPanel.tsx"`
Expected: TSC_OK, biome clean.

- [ ] **Step 7: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/admin/StepUpPrompt.tsx src/components/admin/ShipOrderForm.tsx src/components/admin/ProductForm.tsx src/components/admin/DiscountForm.tsx src/components/admin/SyncPanel.tsx
git commit -m "$(printf 'feat(security): StepUpPrompt re-auth UI wired into admin forms\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Webhook freshness (TDD) + occurredAt on the event contract

**Files:**
- Create: `src/lib/webhook/freshness.ts`, `tests/unit/lib/webhook-freshness.test.ts`
- Modify: `src/domain/payment/ChargeInput.ts`, `src/server/actions/mock-payment.ts`, `tests/unit/domain/payment/mock.test.ts`

- [ ] **Step 1: Write the failing freshness test.** `tests/unit/lib/webhook-freshness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isFresh } from '@/lib/webhook/freshness';

describe('isFresh', () => {
  const W = 5 * 60_000;
  it('accepts an event within the window', () => {
    expect(isFresh(1_000_000, 1_000_000 + 60_000, W)).toBe(true);
  });
  it('rejects an event older than the window', () => {
    expect(isFresh(1_000_000, 1_000_000 + 6 * 60_000, W)).toBe(false);
  });
  it('rejects a far-future event (clock-skew abuse)', () => {
    expect(isFresh(1_000_000 + 6 * 60_000, 1_000_000, W)).toBe(false);
  });
  it('treats the exact boundary as fresh', () => {
    expect(isFresh(1_000_000, 1_000_000 + W, W)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS** (cannot resolve `@/lib/webhook/freshness`).

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/webhook-freshness.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `isFresh`.** `src/lib/webhook/freshness.ts`:

```ts
/** True when occurredAt is within windowMs of now in either direction. The
 *  symmetric check rejects both stale replays and far-future (skewed) stamps. */
export function isFresh(occurredAt: number, now: number, windowMs: number): boolean {
  return Math.abs(now - occurredAt) <= windowMs;
}
```

- [ ] **Step 4: Run the test, verify it PASSES** (4 tests).

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/webhook-freshness.test.ts"`
Expected: PASS.

- [ ] **Step 5: Add `occurredAt` to the event contract.** In `src/domain/payment/ChargeInput.ts`, add a field to `VerifiedEvent` (after `amountThb`):

```ts
  readonly occurredAt: number;
```

- [ ] **Step 6: Stamp `occurredAt` in the simulator.** In `src/server/actions/mock-payment.ts`, in the `JSON.stringify({...})` body object, add after `amountThb: order.total_thb,`:

```ts
    occurredAt: Date.now(),
```

- [ ] **Step 7: Keep the mock test representative.** In `tests/unit/domain/payment/mock.test.ts`, in the "verifies a valid signed notification" body object, add `occurredAt: Date.now(),` after `amountThb: 100,`, and add one assertion after `expect(ev.amountThb).toBe(100);`:

```ts
    expect(typeof ev.occurredAt).toBe('number');
```

- [ ] **Step 8: Run the payment + freshness tests, verify PASS.**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/webhook-freshness.test.ts tests/unit/domain/payment/mock.test.ts"`
Expected: PASS (all).

- [ ] **Step 9: Typecheck + lint.**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/lib/webhook/freshness.ts tests/unit/lib/webhook-freshness.test.ts src/domain/payment/ChargeInput.ts src/server/actions/mock-payment.ts tests/unit/domain/payment/mock.test.ts"`
Expected: TSC_OK, biome clean.

- [ ] **Step 10: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/lib/webhook/freshness.ts tests/unit/lib/webhook-freshness.test.ts src/domain/payment/ChargeInput.ts src/server/actions/mock-payment.ts tests/unit/domain/payment/mock.test.ts
git commit -m "$(printf 'feat(security): webhook freshness check + occurredAt on event contract (TDD)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: `processed_webhook_events` migration + regenerate types

**Files:**
- Create: `supabase/migrations/20260628001000_processed_webhook_events.sql`

> Requires the local Supabase stack running (Docker WSL integration on, `supabase start`). If you cannot start it, STOP and report — Task 6 needs the regenerated types to typecheck.

- [ ] **Step 1: Write the migration.** `supabase/migrations/20260628001000_processed_webhook_events.sql`:

```sql
-- Durable, atomic webhook dedup. The unique (provider, event_id) lets the
-- notify handler insert-once: a 23505 conflict means "already processed".
-- Service role bypasses RLS; no policies = anon/auth get no access.
create table public.processed_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  order_id uuid references public.orders(id),
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.processed_webhook_events enable row level security;
```

- [ ] **Step 2: Apply the migration locally.** Write `\\wsl.localhost\Ubuntu\tmp\p6a2-db.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
supabase migration up 2>&1 | tail -8
```

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-db.sh"`
Expected: applies `20260628001000_processed_webhook_events`. (If the stack reports it is not running, run `supabase start` first.)

- [ ] **Step 3: Regenerate DB types.** Write `\\wsl.localhost\Ubuntu\tmp\p6a2-types.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun run db:types 2>&1 | tail -8
```

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-types.sh"`
Expected: `src/db/types.gen.ts` updates to include `processed_webhook_events`. Confirm with: `wsl -d Ubuntu -- bash -lc "grep -c processed_webhook_events /home/ton/workspace/rb_shop/src/db/types.gen.ts"` → ≥ 1.

- [ ] **Step 4: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add supabase/migrations/20260628001000_processed_webhook_events.sql src/db/types.gen.ts
git commit -m "$(printf 'feat(security): processed_webhook_events table for atomic webhook dedup\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Harden the payment webhook (freshness + atomic dedup)

**Files:**
- Modify: `src/app/api/payments/notify/[provider]/route.ts`

- [ ] **Step 1: Add the freshness import.** Add to the imports:

```ts
import { isFresh } from '@/lib/webhook/freshness';
```

- [ ] **Step 2: Reject stale events.** Immediately after the `try { event = ... } catch { ... }` block (before `const supa = createServiceRoleSupabase();`), add:

```ts
  if (!isFresh(event.occurredAt, Date.now(), 5 * 60_000)) {
    return NextResponse.json({ error: 'Stale event' }, { status: 400 });
  }
```

- [ ] **Step 3: Replace the dedup check with an atomic insert.** Delete these lines:

```ts
  if (order.last_event_id === event.eventId) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  if (order.total_thb !== event.amountThb) {
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }
```

and replace them with (amount check kept, atomic dedup added after it):

```ts
  if (order.total_thb !== event.amountThb) {
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  // Atomic, durable dedup: the unique (provider, event_id) constraint makes a
  // concurrent or replayed delivery fail with 23505 instead of double-processing.
  const { error: dedupError } = await supa
    .from('processed_webhook_events')
    .insert({ provider: providerKey, event_id: event.eventId, order_id: order.id });
  if (dedupError) {
    if (dedupError.code === '23505') {
      return NextResponse.json({ ok: true, dedup: true });
    }
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  }
```

(The `update(...)` that writes `last_event_id` stays as-is — it remains for display, just no longer load-bearing for dedup.)

- [ ] **Step 4: Typecheck + lint + build.** Write `\\wsl.localhost\Ubuntu\tmp\p6a2-build.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun run tsc --noEmit 2>&1 | tail -6 && echo TSC_OK
bun run biome check --write src/app/api/payments/notify/'[provider]'/route.ts 2>&1 | tail -3
node ./node_modules/next/dist/bin/next build 2>&1 | grep -vE 'unique .key. prop|warning-keys|top-level render' | grep -E "Compiled|error|Error|Failed" | tail -6
```

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-build.sh"`
Expected: TSC_OK, biome clean, `Compiled successfully`.

- [ ] **Step 5: Manual dedup check (local stack up).** With `supabase start` and `bun run dev` running, post the same signed event twice and confirm the second is a no-op. Write `\\wsl.localhost\Ubuntu\tmp\p6a2-replay.mjs` (fill in a real pending order id + its total in `OID`/`AMT`):

```js
import { createHmac } from 'node:crypto';
const OID = process.env.OID;           // a real pending order id
const AMT = Number(process.env.AMT);   // that order's total_thb
const secret = process.env.RB_SHOP_MOCK_SECRET || 'dev-mock-secret';
const body = JSON.stringify({
  eventId: 'manual_dupe_1', orderId: OID, chargeId: 'mock_x',
  status: 'paid', amountThb: AMT, occurredAt: Date.now(),
});
const sig = createHmac('sha256', secret).update(body).digest('base64url');
for (let i = 0; i < 2; i++) {
  const r = await fetch('http://localhost:3000/api/payments/notify/mock', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mock-signature': sig },
    body,
  });
  console.log(i, r.status, await r.text());
}
```

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && export PATH=\$HOME/.local/bin:\$PATH && OID=<ORDER_ID> AMT=<ORDER_TOTAL_THB> node /tmp/p6a2-replay.mjs"`
Expected: first call `{ ok: true }` (or already-paid), second call `{ ok: true, dedup: true }`. This verifies behavior; it does not block the commit if the local stack is unavailable — note that and move on.

- [ ] **Step 6: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/api/payments/notify/[provider]/route.ts"
git commit -m "$(printf 'feat(security): atomic webhook dedup + freshness window on payment notify\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Nonce-based CSP for /admin

**Files:**
- Modify: `src/lib/security/headers.ts`, `tests/unit/lib/security-headers.test.ts`, `src/proxy.ts`

- [ ] **Step 1: Add the nonce cases to the headers test.** In `tests/unit/lib/security-headers.test.ts`, add inside the existing `describe('securityHeaders', ...)`:

```ts
  it('uses a nonce and drops script unsafe-inline when a nonce is provided', () => {
    const csp = securityHeaders({
      isDev: false,
      supabaseHost: 'https://abc.supabase.co',
      nonce: 'abc123',
    })['Content-Security-Policy'];
    expect(csp).toContain("'nonce-abc123'");
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).toContain('https://challenges.cloudflare.com');
  });

  it('keeps style-src unsafe-inline even with a nonce', () => {
    const csp = securityHeaders({
      isDev: false,
      supabaseHost: 'https://abc.supabase.co',
      nonce: 'abc123',
    })['Content-Security-Policy'];
    const styleSrc = csp.split('; ').find((d) => d.startsWith('style-src')) ?? '';
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it('falls back to script unsafe-inline without a nonce', () => {
    const csp = securityHeaders({ isDev: false, supabaseHost: 'https://abc.supabase.co' })[
      'Content-Security-Policy'
    ];
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scriptSrc).toContain("'unsafe-inline'");
  });
```

- [ ] **Step 2: Run the headers test, verify the new cases FAIL** (nonce not yet supported).

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/security-headers.test.ts"`
Expected: the three new cases FAIL (no `'nonce-abc123'`), old cases pass.

- [ ] **Step 3: Add nonce support to `securityHeaders`.** Replace the full contents of `src/lib/security/headers.ts` with:

```ts
export interface HeaderOpts {
  isDev: boolean;
  supabaseHost: string;
  nonce?: string;
}

/** HTTP security headers + a pragmatic CSP. In dev, the CSP also allows the
 *  Next HMR websocket and eval; production omits both. When a `nonce` is given
 *  (admin routes), script-src uses the nonce and drops 'unsafe-inline'; style-src
 *  keeps 'unsafe-inline' (React style attributes can't be nonced). */
export function securityHeaders({ isDev, supabaseHost, nonce }: HeaderOpts): Record<string, string> {
  const turnstile = 'https://challenges.cloudflare.com';
  const connect = ["'self'", supabaseHost, turnstile, isDev ? 'ws: wss:' : ''].filter(Boolean);
  const scriptInline = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'";
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
```

- [ ] **Step 4: Run the headers test, verify it PASSES** (all cases).

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/security-headers.test.ts"`
Expected: PASS.

- [ ] **Step 5: Generate + apply the nonce in `proxy.ts`.** Replace the full contents of `src/proxy.ts` with:

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

function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith('/admin');
  const isApi = pathname.startsWith('/api');

  // Nonce CSP only on /admin (already dynamic + auth-gated). Storefront and /api
  // keep the pragmatic CSP so storefront pages stay statically cacheable.
  const nonce = isAdmin ? makeNonce() : undefined;
  const headerMap = securityHeaders({
    isDev: process.env.NODE_ENV !== 'production',
    supabaseHost: supabaseHost(),
    nonce,
  });

  const reqHeaders = new Headers(request.headers);
  reqHeaders.set('x-pathname', pathname);
  if (nonce) {
    // Next reads the nonce from the CSP request header and applies it to its
    // own bootstrap scripts.
    reqHeaders.set('x-nonce', nonce);
    reqHeaders.set('Content-Security-Policy', headerMap['Content-Security-Policy']);
  }

  const response =
    isAdmin || isApi
      ? NextResponse.next({ request: { headers: reqHeaders } })
      : (intlMiddleware(request) as NextResponse);

  for (const [k, v] of Object.entries(headerMap)) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
```

- [ ] **Step 6: Typecheck + lint + build.** Reuse the build script pattern:

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && export PATH=\$HOME/.local/bin:\$HOME/.bun/bin:\$PATH && bun run tsc --noEmit 2>&1 | tail -6 && echo TSC_OK && bun run biome check --write src/proxy.ts src/lib/security/headers.ts tests/unit/lib/security-headers.test.ts 2>&1 | tail -3 && node ./node_modules/next/dist/bin/next build 2>&1 | grep -vE 'unique .key. prop|warning-keys|top-level render' | grep -E 'Compiled|error|Error|Failed' | tail -6"`
Expected: TSC_OK, biome clean, `Compiled successfully`.

- [ ] **Step 7: Manual CSP check (dev or built).** With the app running, confirm headers differ by area:

```bash
wsl -d Ubuntu -- bash -lc "echo '--- storefront ---'; curl -sI http://localhost:3000/en | grep -i content-security-policy; echo '--- admin ---'; curl -sI http://localhost:3000/admin/login | grep -i content-security-policy"
```

Expected: storefront `script-src` contains `'unsafe-inline'`; admin `script-src` contains `'nonce-…'` and **not** `'unsafe-inline'`. Load `/admin/login` in a browser and confirm no CSP violation blocks the page (DevTools console clean; the form + Turnstile placeholder render).

- [ ] **Step 8: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/lib/security/headers.ts tests/unit/lib/security-headers.test.ts src/proxy.ts
git commit -m "$(printf 'feat(security): nonce-based CSP on /admin; storefront stays cacheable\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: README + final gate

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Extend the Security section.** In `README.md`, under the existing "Security hardening" section, append:

```markdown
### Step-up auth (recency gate)

Destructive admin actions (ship, product save/archive, discount create/update,
sheets sync) require an interactive sign-in within the last 30 minutes
(`requireRecentAuth` / `stepUpGuard` in `src/db/auth.ts`, using Supabase
`last_sign_in_at`). A stale session returns the `stepUpRequired` sentinel; the
admin UI shows `<StepUpPrompt>` which re-sends a magic link. Bypassed outside
production to keep local admin frictionless.

### Webhook replay hardening

`/api/payments/notify/[provider]` rejects events older than 5 minutes
(`isFresh`, `occurredAt` on the event) and dedups via an atomic insert into
`processed_webhook_events` (`unique (provider, event_id)`) — also closing a
double-process race in the previous read-then-check.

### Admin CSP

`/admin` responses use a per-request nonce (`src/proxy.ts`) so `script-src`
drops `'unsafe-inline'`. The storefront keeps the pragmatic CSP to stay
statically cacheable. `style-src 'unsafe-inline'` remains (React inline style
attributes can't be nonced).
```

- [ ] **Step 2: Run the full gate.** Write `\\wsl.localhost\Ubuntu\tmp\p6a2-gate.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
echo "=== typecheck ==="; bun run tsc --noEmit 2>&1 | tail -6 && echo TSC_OK
echo "=== lint ==="; bun run biome check . 2>&1 | tail -4
echo "=== tests ==="; bun run vitest run 2>&1 | tail -10
echo "=== build ==="; node ./node_modules/next/dist/bin/next build 2>&1 | grep -vE 'unique .key. prop|warning-keys|top-level render' | grep -E "Compiled|error|Error|Failed" | tail -8
```

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"`
Expected: typecheck clean; biome clean; ALL tests pass (incl. new `require-recent-auth`, `webhook-freshness`, extended `security-headers`, and the updated `mock` suite); `Compiled successfully`. Fix and re-run until green.

- [ ] **Step 3: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add README.md
git commit -m "$(printf 'docs: step-up, webhook replay, admin CSP; Plan 6a-2 complete\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Out of scope (later)

| Concern | Plan |
|---|---|
| Storefront nonce CSP (gives up static caching) | later, traffic-driven |
| Drop `style-src 'unsafe-inline'` | later |
| Real FeelFreePay/PSP adapter + its signed `occurredAt` | 6c (parked) |
| E2E tests over the hardened flows | 6b/E2E |
| Production deploy | 6d |
