# Manual PromptPay — Plan A (foundation + buyer flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stand up the data/storage foundation for manual PromptPay payments and the buyer flow: checkout creates a `promptpay_manual` order; the order page shows the QR + amount and lets the buyer upload a bank slip (token-gated signed upload); submitting moves the order to `awaiting_verification`. Admin verification UI is **Plan B** (interim: approve via Studio to exercise `markOrderPaid`).

**Architecture:** New `awaiting_verification` status + `payment_slips`/`payment_settings` tables + public `payment-assets` & private `payment-slips` buckets. The webhook's paid transition is extracted to a shared, testable `markOrderPaid(supa, orderId)`. `placeOrder` switches the default method to manual and redirects to the order page, where a client `PaymentPanel` handles the QR + slip upload via an order-token-gated signed-upload route + a `submitSlip` action.

**Tech Stack:** Next.js 16, Supabase (Postgres + Storage, RLS), next-intl, Zod, Vitest, React Email. Bun except `next build` (Node). Local Supabase up for DB/storage steps.

**Reference:** Spec [docs/superpowers/specs/2026-06-29-rb-shop-manual-promptpay-payments-design.md](../specs/2026-06-29-rb-shop-manual-promptpay-payments-design.md).

---

## Conventions (carry-over)

Branch `develop`, commit per task. Helper `/tmp/p6a2-check.sh <files>` = tsc+biome; `/tmp/vitest.sh <file>`; `next build` = `~/.local/bin/node ./node_modules/next/dist/bin/next build`. Supabase: `~/.local/bin/supabase migration up`; types via `bun run db:types`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Bracketed route paths must be quoted in shell. **Requires the local Supabase stack running** for Tasks 1 & 7.

## File structure

```
supabase/migrations/
  20260629002000_order_status_awaiting_verification.sql   (new — enum value, isolated)
  20260629002100_manual_payments.sql                      (new — tables, buckets, RLS, seed)
src/db/types.gen.ts                                       (regenerated)
src/server/orders/mark-paid.ts                            (new — markOrderPaid + OrderPaid email)
src/app/api/payments/notify/[provider]/route.ts          (modify — call markOrderPaid)
src/server/actions/orders.ts                             (modify — placeOrder → manual)
src/app/api/storage/sign-slip-upload/route.ts            (new — token-gated slip signed upload)
src/server/actions/submit-slip.ts                        (new — submitSlip action)
src/server/queries/payment-settings.ts                   (new — getPaymentSettings)
emails/SlipReceived.tsx                                   (new — React Email template)
src/components/order/PaymentPanel.tsx                     (new — QR + amount + slip upload)
src/app/[locale]/order/[id]/page.tsx                     (modify — render PaymentPanel)
tests/unit/server/mark-paid.test.ts                      (new)
```

---

## Task 1: Migration — status, tables, buckets, RLS

**Files:** Create the two migrations; regen types.

- [ ] **Step 1: Enum value (isolated migration).** `supabase/migrations/20260629002000_order_status_awaiting_verification.sql`:

```sql
-- Adding an enum value must not share a transaction with DDL that uses it.
alter type public.order_status add value if not exists 'awaiting_verification' after 'awaiting_payment';
```

- [ ] **Step 2: Tables + buckets + RLS.** `supabase/migrations/20260629002100_manual_payments.sql`:

```sql
-- Slip submissions (audit trail; supports re-uploads). Service-role only.
create table public.payment_slips (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text
);
create index payment_slips_order_idx on public.payment_slips(order_id);
create index payment_slips_status_idx on public.payment_slips(status);
alter table public.payment_slips enable row level security;
-- No policies: service role only.

-- Singleton store payment settings (PromptPay QR + instructions). Public read.
create table public.payment_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  promptpay_qr_path text,
  account_label text,
  instructions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.payment_settings (id) values ('singleton') on conflict do nothing;
alter table public.payment_settings enable row level security;
create policy "payment_settings public read" on public.payment_settings for select using (true);
create policy "payment_settings owner write" on public.payment_settings for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Buckets: public QR assets, private slips.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-assets', 'payment-assets', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-slips', 'payment-slips', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- payment-assets: public read; owner/dev write.
create policy "payment-assets read" on storage.objects for select using (bucket_id = 'payment-assets');
create policy "payment-assets owner write" on storage.objects for insert
  with check (bucket_id = 'payment-assets' and public.is_owner_or_dev());
create policy "payment-assets owner update" on storage.objects for update
  using (bucket_id = 'payment-assets' and public.is_owner_or_dev())
  with check (bucket_id = 'payment-assets' and public.is_owner_or_dev());
-- payment-slips: no policies (service-role + signed URLs only).
```

(The `public.is_owner_or_dev()` SQL helper already exists — it gates `product-images`.)

- [ ] **Step 3: Apply + regen types.** Write `\\wsl.localhost\Ubuntu\tmp\mp-db.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
supabase migration up 2>&1 | tail -8
bun run db:types 2>&1 | tail -4
```
Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/mp-db.sh"`. Confirm: `wsl -d Ubuntu -- bash -lc "grep -c -E 'payment_slips|payment_settings' /home/ton/workspace/rb_shop/src/db/types.gen.ts"` → ≥ 2. Quick tsc: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run tsc --noEmit 2>&1 | tail -5"`.

- [ ] **Step 4: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add supabase/migrations/20260629002000_order_status_awaiting_verification.sql supabase/migrations/20260629002100_manual_payments.sql src/db/types.gen.ts
git commit -m "$(printf 'feat(pay): manual-payment schema (status, slips, settings, buckets)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Extract `markOrderPaid` (TDD) + webhook refactor

**Files:** Create `src/server/orders/mark-paid.ts`, `tests/unit/server/mark-paid.test.ts`; modify the notify route.

- [ ] **Step 1: Write the failing test.** `tests/unit/server/mark-paid.test.ts` — verifies the function sets paid, decrements reserved stock per item, is idempotent (no double work when already paid). Use a fake supabase client recording calls.

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => {}) }));
vi.mock('emails/OrderPaid', () => ({ default: () => null }));

const { markOrderPaid } = await import('@/server/orders/mark-paid');

function fakeSupa(order: { id: string; status: string } | null, items: { variant_id: string; qty: number }[], variants: Record<string, { stock_reserved: number }>) {
  const updates: { table: string; values: Record<string, unknown>; id?: string }[] = [];
  const api = {
    from(table: string) {
      return {
        select: () => ({
          eq: (_c: string, id: string) => ({
            maybeSingle: async () => {
              if (table === 'orders') return { data: order };
              if (table === 'variants') return { data: variants[id] ?? null };
              return { data: null };
            },
            // order_items.select('...').eq('order_id', ...)
            then: undefined,
          }),
          // order_items path: .select().eq() returns {data: items}
        }),
        update: (values: Record<string, unknown>) => ({
          eq: async (_c: string, id: string) => {
            updates.push({ table, values, id });
            return { error: null };
          },
        }),
        insert: async () => ({ error: null }),
      };
    },
  };
  return { api, updates };
}

describe('markOrderPaid', () => {
  it('no-ops when the order is already paid', async () => {
    const { api, updates } = fakeSupa({ id: 'o1', status: 'paid' }, [], {});
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake client
    await markOrderPaid(api as any, 'o1');
    expect(updates.find((u) => u.table === 'orders' && u.values.status === 'paid')).toBeUndefined();
  });
});
```

> NOTE for the implementer: the fake-client shape above is illustrative — adapt it to however `markOrderPaid` chains Supabase calls (it must read the order via `.select(...).eq('id').maybeSingle()`, read items via `.select(...).eq('order_id', id)`, read each variant's `stock_reserved`, and `.update(...).eq('id', ...)`). Add at least: the idempotent no-op test above, plus one test that a fresh `awaiting_verification` order ends with an `orders.update({status:'paid'})` and a `variants.update` reducing `stock_reserved`. Keep the email mocked.

- [ ] **Step 2: Implement `src/server/orders/mark-paid.ts`.**

```ts
import 'server-only';
import OrderPaid from 'emails/OrderPaid';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/db/types.gen';
import { formatMoney, money } from '@/domain/money';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** The post-verification "order is paid" transition, shared by the PSP webhook
 *  (FFP later) and the manual slip approval. Idempotent: a no-op if already paid.
 *  Sets paid/paid_at/ship_status, releases reserved stock, logs an event, emails. */
export async function markOrderPaid(
  supa: SupabaseClient<Database>,
  orderId: string,
  opts: { actor?: string } = {},
): Promise<void> {
  const actor = opts.actor ?? 'system';
  const { data: order } = await supa
    .from('orders')
    .select('id, status, total_thb, number, customer_email, locale')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.status === 'paid') return;

  await supa
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), ship_status: 'preparing' })
    .eq('id', orderId);

  const { data: items } = await supa
    .from('order_items')
    .select('variant_id, qty, product_snapshot')
    .eq('order_id', orderId);

  for (const it of items ?? []) {
    if (!it.variant_id) continue;
    const { data: v } = await supa
      .from('variants')
      .select('stock_reserved')
      .eq('id', it.variant_id)
      .maybeSingle();
    if (v) {
      await supa
        .from('variants')
        .update({ stock_reserved: Math.max(0, v.stock_reserved - it.qty) })
        .eq('id', it.variant_id);
    }
  }

  await supa
    .from('order_events')
    .insert({ order_id: orderId, type: 'payment.paid', payload: { actor }, actor });

  try {
    const locale = order.locale === 'th' ? 'th' : 'en';
    const emailItems = (items ?? []).map((it) => {
      const snap = it.product_snapshot as { name?: { th?: string; en?: string } } | null;
      return {
        name: snap?.name?.[locale] ?? snap?.name?.en ?? snap?.name?.th ?? 'item',
        qty: it.qty,
      };
    });
    const orderUrl = `${siteUrl()}/${locale}/order/${orderId}?t=${signOrderToken(orderId, order.customer_email)}`;
    await sendEmail({
      to: order.customer_email,
      subject: `Payment received — order ${order.number}`,
      react: OrderPaid({
        orderNumber: order.number,
        orderUrl,
        items: emailItems,
        totalLabel: formatMoney(money(order.total_thb), locale),
      }),
    });
  } catch (err) {
    console.error('[markOrderPaid] confirmation email failed', err);
  }
}
```

- [ ] **Step 3: Run the test → PASS.** `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/server/mark-paid.test.ts"`.

- [ ] **Step 4: Refactor the webhook** (`src/app/api/payments/notify/[provider]/route.ts`) to delegate. Replace the whole `if (event.status === 'paid') { ... }` block (the order update + stock loop + order_event insert + the email try/catch) with:

```ts
  if (event.status === 'paid') {
    await markOrderPaid(supa, order.id, { actor: 'system' });
    await supa.from('orders').update({ last_event_id: event.eventId }).eq('id', order.id);
  } else if (event.status === 'failed' || event.status === 'expired') {
```

Add the import `import { markOrderPaid } from '@/server/orders/mark-paid';` and remove now-unused imports (`OrderPaid`, `formatMoney`/`money`, `sendEmail`, `signOrderToken` — keep any still used by the failed branch; verify with tsc/biome). The `failed`/`expired` branch is unchanged.

- [ ] **Step 5: tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/orders/mark-paid.ts tests/unit/server/mark-paid.test.ts 'src/app/api/payments/notify/[provider]/route.ts'"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/orders/mark-paid.ts tests/unit/server/mark-paid.test.ts "src/app/api/payments/notify/[provider]/route.ts"
git commit -m "$(printf 'refactor(pay): extract shared markOrderPaid; webhook delegates (TDD)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: `placeOrder` → manual PromptPay

**Files:** Modify `src/server/actions/orders.ts`.

The order is created the same way; only the payment leg changes — no MockProvider charge, `payment_provider='promptpay_manual'`, redirect to the order page.

- [ ] **Step 1: Replace the payment leg.** In `placeOrder`, change the order `insert(...)` field `payment_provider: 'mock'` → `payment_provider: 'promptpay_manual'`. Then DELETE the block that builds `origin`, constructs `new MockProvider()`, calls `createCharge`, and updates `payment_charge_id` (lines from `const h = await headers();` through the `payment_charge_id` update). Replace the final `return` with:

```ts
  return {
    ok: true as const,
    orderId: order.id,
    orderNumber: order.number,
    token: signOrderToken(order.id, input.email),
    redirectUrl: `/${input.locale}/order/${order.id}?t=${signOrderToken(order.id, input.email)}`,
  };
}
```

Remove the now-unused `headers`, `MockProvider` imports (keep `signOrderToken`). Verify the `CheckoutForm` uses `redirectUrl` for navigation (it already does — confirm by reading it; no change expected).

- [ ] **Step 2: tsc + biome + build + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/actions/orders.ts"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/actions/orders.ts
git commit -m "$(printf 'feat(pay): checkout creates promptpay_manual orders → order page\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Token-gated slip signed-upload route

**Files:** Create `src/app/api/storage/sign-slip-upload/route.ts`.

Authorizes a slip upload using the **order token** (the buyer's credential), checks the order is in a payable state, then issues a signed upload URL into `payment-slips/{orderId}/...`. Rate-limited.

- [ ] **Step 1: Create the route.** (Reuses `verifyOrderToken` from `@/lib/order-token` — confirm its exported name by reading the file; it pairs with `signOrderToken`.)

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { verifyOrderToken } from '@/lib/order-token';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function POST(request: NextRequest) {
  const ip = await clientIp();
  const rl = await enforceRateLimit('slip-upload', ip, { max: 10, windowMs: 600_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const { orderId, token, contentType, ext } = (await request.json()) as {
    orderId?: string;
    token?: string;
    contentType?: string;
    ext?: string;
  };
  if (!orderId || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!contentType || !ALLOWED.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const supa = createServiceRoleSupabase();
  const { data: order } = await supa
    .from('orders')
    .select('id, status, customer_email')
    .eq('id', orderId)
    .maybeSingle();
  // Token is HMAC-bound to (orderId, email) — verify against the order's email.
  if (!order || !verifyOrderToken(token, orderId, order.customer_email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (order.status !== 'awaiting_payment' && order.status !== 'awaiting_verification') {
    return NextResponse.json({ error: 'Order not awaiting payment' }, { status: 409 });
  }

  const safeExt = /^(png|jpg|jpeg|webp)$/.test(ext ?? '') ? ext : 'png';
  const path = `${orderId}/${Date.now()}.${safeExt}`;
  const { data, error } = await supa.storage.from('payment-slips').createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Sign failed' }, { status: 500 });
  }
  return NextResponse.json({ token: data.token, path: data.path });
}
```

> Signature (confirmed): `verifyOrderToken(token: string, orderId: string, email: string): boolean` — the token is HMAC-bound to (orderId, lowercased email), so you must fetch the order's `customer_email` and pass it (as above). `ALLOWED` is the mime set; `ext` is the file extension from the client.

- [ ] **Step 2: tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh 'src/app/api/storage/sign-slip-upload/route.ts'"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/api/storage/sign-slip-upload/route.ts"
git commit -m "$(printf 'feat(pay): token-gated signed upload for payment slips\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: `submitSlip` action + SlipReceived email

**Files:** Create `src/server/actions/submit-slip.ts`, `emails/SlipReceived.tsx`.

After the buyer uploads to the signed URL, this records the slip + flips the order to `awaiting_verification` + emails.

- [ ] **Step 1: SlipReceived email.** `emails/SlipReceived.tsx` — mirror an existing template in `emails/` (e.g. `OrderShipped`): props `{ orderNumber: string; orderUrl: string }`, body = "We've received your payment slip for order {orderNumber} and will confirm it shortly." + a link to `orderUrl`. (Read an existing template first for the exact `@react-email/components` imports + style.)

- [ ] **Step 2: submitSlip action.** `src/server/actions/submit-slip.ts`:

```ts
'use server';

import SlipReceived from 'emails/SlipReceived';
import { createServiceRoleSupabase } from '@/db/server';
import { sendEmail } from '@/lib/email';
import { verifyOrderToken } from '@/lib/order-token';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function submitSlip(input: {
  orderId: string;
  token: string;
  storagePath: string;
}): Promise<{ ok: true } | { error: string }> {
  const supa = createServiceRoleSupabase();

  const { data: order } = await supa
    .from('orders')
    .select('id, status, number, customer_email, locale')
    .eq('id', input.orderId)
    .maybeSingle();
  // Token is HMAC-bound to (orderId, email) — verify against the order's email.
  if (!order || !verifyOrderToken(input.token, input.orderId, order.customer_email)) {
    return { error: 'Unauthorized' };
  }
  if (order.status !== 'awaiting_payment' && order.status !== 'awaiting_verification') {
    return { error: 'Order not awaiting payment' };
  }

  await supa.from('payment_slips').insert({ order_id: order.id, storage_path: input.storagePath });
  await supa.from('orders').update({ status: 'awaiting_verification' }).eq('id', order.id);
  await supa.from('order_events').insert({
    order_id: order.id,
    type: 'payment.slip_submitted',
    payload: { path: input.storagePath },
    actor: 'customer',
  });

  try {
    const locale = order.locale === 'th' ? 'th' : 'en';
    const orderUrl = `${siteUrl()}/${locale}/order/${order.id}?t=${input.token}`;
    await sendEmail({
      to: order.customer_email,
      subject: `Slip received — order ${order.number}`,
      react: SlipReceived({ orderNumber: order.number, orderUrl }),
    });
  } catch (err) {
    console.error('[submitSlip] email failed', err);
  }
  return { ok: true };
}
```

- [ ] **Step 3: tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/actions/submit-slip.ts emails/SlipReceived.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/actions/submit-slip.ts emails/SlipReceived.tsx
git commit -m "$(printf 'feat(pay): submitSlip action + SlipReceived email\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: PaymentPanel + order-page integration

**Files:** Create `src/server/queries/payment-settings.ts`, `src/components/order/PaymentPanel.tsx`; modify the order page.

- [ ] **Step 1: Payment-settings query.** `src/server/queries/payment-settings.ts`:

```ts
import 'server-only';
import { createServerSupabase } from '@/db/server';

export interface PaymentSettings {
  qrUrl: string | null;
  accountLabel: string | null;
  instructions: { th?: string; en?: string };
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('payment_settings')
    .select('promptpay_qr_path, account_label, instructions')
    .eq('id', 'singleton')
    .maybeSingle();
  const qrUrl = data?.promptpay_qr_path
    ? supa.storage.from('payment-assets').getPublicUrl(data.promptpay_qr_path).data.publicUrl
    : null;
  return {
    qrUrl,
    accountLabel: data?.account_label ?? null,
    instructions: (data?.instructions as { th?: string; en?: string }) ?? {},
  };
}
```

- [ ] **Step 2: PaymentPanel (client).** `src/components/order/PaymentPanel.tsx` — props `{ orderId, token, locale, amountThb, status, qrUrl, accountLabel, instructions }`. Behaviour (follow the `ImagePicker` upload pattern + `useCart`-style states):
  - If `status === 'awaiting_verification'`: show a "we're verifying your payment" message (with the option to re-upload — reuse the uploader).
  - If `status === 'awaiting_payment'`: render the **QR** (`<img src={qrUrl}>` in a `bg-field` frame, or a "QR not configured yet" note if null), the **amount** (`฿{amountThb}`), the `accountLabel` + `instructions[locale]`, then a **file input** (accept the 3 mime types). On file pick: POST `/api/storage/sign-slip-upload` `{ orderId, token, contentType: file.type, ext }` → `uploadToSignedUrl('payment-slips', path, slipToken, file, { contentType })` (via `createBrowserSupabase().storage`) → call `submitSlip({ orderId, token, storagePath: path })` → on `ok`, `router.refresh()` and show success.
  - Editorial Mono styling (tokens: `border-line`, `bg-surface`, `bg-field`, `text-ink/muted`; `Button variant="solid"` for the submit). i18n via `useTranslations('pay')` (keys added in Plan B; for Plan A use literal English fallbacks OR add a minimal `pay` namespace now — implementer's choice, but if using `t()` you MUST add the keys to en+th this task to keep the build green).

  Keep this component focused: the QR/amount/instructions display + the upload→submit flow. ~120 lines.

- [ ] **Step 3: Wire into the order page.** In `src/app/[locale]/order/[id]/page.tsx`, after resolving `data`/`order`/`token`, when `order.status === 'awaiting_payment' || order.status === 'awaiting_verification'`, fetch `getPaymentSettings()` and render `<PaymentPanel ... />` near the top of the `<article>` (above the existing summary). Pass `amountThb={order.total_thb}`, `status={order.status}`, `qrUrl`/`accountLabel`/`instructions` from settings, `orderId={order.id}`, `token={token}`, `locale`.

- [ ] **Step 4: tsc + biome + build + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/queries/payment-settings.ts src/components/order/PaymentPanel.tsx 'src/app/[locale]/order/[id]/page.tsx'"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/queries/payment-settings.ts src/components/order/PaymentPanel.tsx "src/app/[locale]/order/[id]/page.tsx" messages/en.json messages/th.json
git commit -m "$(printf 'feat(pay): buyer PaymentPanel (QR + slip upload) on the order page\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Runtime gate (Plan A)

**Files:** none.

- [ ] **Step 1: Full gate.** `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` → typecheck/lint/tests/build all green (incl. the new `mark-paid` test).

- [ ] **Step 2: Seed a QR for testing** (Plan B builds the admin uploader; for now seed via Studio/SQL). Upload any test PNG to the `payment-assets` bucket (path e.g. `qr/test.png`) and:
  `wsl -d Ubuntu -- bash -lc "docker exec supabase_db_rb_shop psql -U postgres -c \"update public.payment_settings set promptpay_qr_path='qr/test.png', account_label='rainbykello PromptPay' where id='singleton';\""`

- [ ] **Step 3: Manual buyer flow** (dev server + local stack up): add a product to cart → checkout → it lands on the **order page** showing the QR + amount + slip upload. Pick an image → it uploads (signed) → `submitSlip` → page shows "verifying", order is `awaiting_verification`, a `payment_slips` row exists, and Mailpit (`http://127.0.0.1:54324`) has the "Slip received" email. Then exercise `markOrderPaid` via SQL to simulate approval:
  `wsl -d Ubuntu -- bash -lc "docker exec supabase_db_rb_shop psql -U postgres -tAc \"select id from public.orders where status='awaiting_verification' order by created_at desc limit 1;\""` → take the id → there's no SQL call to `markOrderPaid` (it's TS), so instead reload the order page after **Plan B** ships approval; for Plan A, verify the `awaiting_verification` state + slip row + email is sufficient. Note results.

- [ ] **Step 3 (commit if fixes):** `fix(pay): …`.

---

## Plan B (next): admin
QR-settings upload screen + `savePaymentSettings`; `/admin/orders` verification (slip view via signed download + Approve→`markOrderPaid`/Reject→reason+`SlipRejected` email); `StatusPill` `awaiting_verification` label; full `pay.*`/`admin.payments` i18n; end-to-end approve/reject gate.
