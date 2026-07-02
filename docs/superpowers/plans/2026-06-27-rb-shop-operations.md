# rb_shop — Plan 4: Operations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give rainbykello the daily-driver admin surface — orders list + fulfillment, discount-code management, waitlist for sold-out variants — plus transactional email (Resend) and a Vercel cron to release stale `awaiting_payment` holds. End state: she can mark an order shipped with carrier + tracking, the buyer's `/order/[id]` page reflects it, the buyer receives an email; she can create a discount code that actually applies at checkout; she can see who's waiting on a sold-out variant; stale unpaid orders auto-release reserved stock so the catalog doesn't bleed.

**Architecture:**
- **Email behind a thin abstraction** — `lib/email.ts::sendEmail(to, subject, react)` uses Resend if `RESEND_API_KEY` is set, otherwise logs to console. Templates live in `emails/` as React Email components for type-safe rendering.
- **Admin orders** under `/admin/orders` and `/admin/orders/[id]` — list with status filters, detail with line items + shipping address + audit log + ship form.
- **Discount admin** under `/admin/discounts` mirrors the products admin pattern.
- **Waitlist** — fan submits email at the PDP "notify me" button (replacing the sold-out state); `/admin/waitlists` shows pending entries grouped by variant; flipping `stock_available > 0` triggers a cron-run email batch.
- **Cron handlers** at `/api/cron/release-stale` and `/api/cron/notify-waitlist`, protected by a shared `CRON_SECRET` header. Vercel free tier supports 2 daily crons — we hit hourly via a single dispatcher.

**Tech stack additions:** `resend` SDK + `@react-email/components`. No recurring cost (Resend 3K/mo free).

**Locked decisions for this plan:**
- Stale-hold release window: **30 minutes** (spec §3.2).
- Waitlist email cadence: **fan emails the first 20 waiters per restock, then 4-hour gap before next batch** (avoids inbox storms).
- Carrier registry (D16): **Thailand Post, Kerry Express, Flash Express, J&T Express, DHL, FedEx, UPS** — owner picks from a select; URL templated.
- Email "from": **`onboarding@resend.dev`** in dev/demo (Resend's shared sender); real domain in Plan 6 (D8).
- Cron auth: shared `CRON_SECRET` header (Vercel injects it on the schedule). Plan 6 hardens with Turnstile + rate limiting.

---

## File structure built by this plan

```
rb_shop/
├── emails/
│   ├── OrderPaid.tsx
│   ├── OrderShipped.tsx
│   └── WaitlistRestock.tsx
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx                   (list + filter)
│   │   │   │   └── [id]/page.tsx              (detail + ship form)
│   │   │   ├── discounts/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/edit/page.tsx
│   │   │   └── waitlists/page.tsx
│   │   └── api/
│   │       ├── waitlist/route.ts              (POST: join)
│   │       └── cron/
│   │           ├── release-stale/route.ts
│   │           └── notify-waitlist/route.ts
│   ├── components/
│   │   ├── admin/
│   │   │   ├── OrdersTable.tsx
│   │   │   ├── ShipOrderForm.tsx
│   │   │   ├── DiscountForm.tsx
│   │   │   └── WaitlistsTable.tsx
│   │   └── shop/
│   │       └── WaitlistButton.tsx
│   ├── domain/
│   │   ├── carriers.ts                        (TDD — tracking URL templates)
│   │   └── stale-orders.ts                    (TDD — release calculation)
│   ├── lib/
│   │   └── email.ts                           (Resend-or-console abstraction)
│   ├── server/
│   │   ├── actions/
│   │   │   ├── ship-order.ts
│   │   │   ├── discounts.ts
│   │   │   └── waitlist.ts
│   │   └── queries/
│   │       ├── admin-orders.ts
│   │       └── admin-waitlists.ts
│   └── supabase/migrations/
│       ├── 20260627002000_waitlists.sql       (waitlist_entries + RLS + grants)
│       └── 20260627002100_waitlists_notify.sql (notification trigger)
└── tests/
    ├── unit/
    │   ├── domain/
    │   │   ├── carriers.test.ts
    │   │   └── stale-orders.test.ts
    │   └── lib/
    │       └── email.test.ts
```

---

## Conventions (carry-over)

Branch `develop`, commit per task. Bun for everything except `next build`. `import * as z from 'zod'`. TDD for `carriers`, `stale-orders`, and `email`. Migrations include `service_role` grants. UI verified by build + manual.

---

## Task 1: Waitlist migration

**Files:** `supabase/migrations/20260627002000_waitlists.sql`, `supabase/policies/waitlists.sql`

```sql
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  email text not null,
  locale text not null check (locale in ('th','en')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (variant_id, email)
);

create index waitlist_entries_variant_idx on public.waitlist_entries(variant_id);
create index waitlist_entries_pending_idx
  on public.waitlist_entries(variant_id, created_at)
  where notified_at is null;

alter table public.waitlist_entries enable row level security;

-- anon can join the waitlist (own email only)
create policy "waitlist_anon_insert"
on public.waitlist_entries for insert
to anon, authenticated
with check (true);

-- owner/dev manage
create policy "waitlist_owner_dev_all"
on public.waitlist_entries for all
to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

grant insert on public.waitlist_entries to anon, authenticated;
grant select, insert, update, delete on public.waitlist_entries to authenticated, service_role;
```

Apply + re-bootstrap dev user. Mirror policies file. Commit.

---

## Task 2: Regenerate types + commit

```bash
~/.bun/bin/bun run db:types
git commit -m "chore(db): regenerate types for waitlist_entries"
```

---

## Task 3: Domain — `carriers` (TDD)

**Files:** `src/domain/carriers.ts`, `tests/unit/domain/carriers.test.ts`

Registry of 7 carriers with tracking URL templates. `buildTrackingUrl(carrier, number)` returns the deep link or null.

```ts
// src/domain/carriers.ts
export const CARRIERS = {
  thailand_post: { label: 'Thailand Post', url: (n) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(n)}` },
  kerry:         { label: 'Kerry Express', url: (n) => `https://th.kerryexpress.com/track/?track=${encodeURIComponent(n)}` },
  flash:         { label: 'Flash Express', url: (n) => `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(n)}` },
  jnt:           { label: 'J&T Express', url: (n) => `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${encodeURIComponent(n)}` },
  dhl:           { label: 'DHL', url: (n) => `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}` },
  fedex:         { label: 'FedEx', url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  ups:           { label: 'UPS', url: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
} as const;

export type CarrierKey = keyof typeof CARRIERS;

export function buildTrackingUrl(key: string, number: string): string | null {
  const c = (CARRIERS as Record<string, { url: (n: string) => string }>)[key];
  return c ? c.url(number) : null;
}
```

Tests: each carrier produces a URL containing the encoded tracking number; unknown carrier returns null; numbers with special chars get encoded.

Commit.

---

## Task 4: Domain — `stale-orders` (TDD)

**Files:** `src/domain/stale-orders.ts`, `tests/unit/domain/stale-orders.test.ts`

Pure function `isStale(order, now, holdMinutes)` — returns true when an order is `awaiting_payment` and `created_at` is older than the threshold.

Tests cover: stale vs fresh; ignores non-awaiting_payment statuses; configurable threshold; edge case at exactly threshold.

Commit.

---

## Task 5: Email abstraction (TDD)

**Files:** `src/lib/email.ts`, `tests/unit/lib/email.test.ts`. Install `resend` + `@react-email/components`.

```ts
// src/lib/email.ts
import 'server-only';
import { Resend } from 'resend';
import type { ReactElement } from 'react';

const FROM = process.env.RESEND_FROM ?? 'rainbykello <onboarding@resend.dev>';

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailInput) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] (no RESEND_API_KEY) → would send to ${to}: ${subject}`);
    return { ok: true as const, dryRun: true };
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({ from: FROM, to, subject, react });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, dryRun: false };
}
```

Tests: with key absent → dryRun true; with key present (mock fetch) → calls the SDK. Commit.

---

## Task 6: Email templates (3)

**Files:** `emails/OrderPaid.tsx`, `emails/OrderShipped.tsx`, `emails/WaitlistRestock.tsx`

Use `@react-email/components` primitives. Each template takes typed props and renders a clean Soft-Studio email. No links to in-progress features. Commit.

---

## Task 7: Wire confirmation email on `payment.paid`

**Files:** modify `src/app/api/payments/notify/[provider]/route.ts`

After committing stock on `paid`, fetch order + items, render `OrderPaid` with token-signed receipt link, call `sendEmail`. Wrapped in `try/catch` so email failures don't block the order transition. Commit.

---

## Task 8: Server action — `shipOrder`

**Files:** `src/server/actions/ship-order.ts`

```ts
'use server';

import * as z from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { buildTrackingUrl } from '@/domain/carriers';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';
import OrderShipped from 'emails/OrderShipped';

const ShipInput = z.object({
  orderId: z.string().uuid(),
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
  estimatedDeliveryDate: z.string().optional(),
  notesToBuyer: z.string().optional(),
});

export async function shipOrder(raw: z.infer<typeof ShipInput>) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const input = ShipInput.parse(raw);
  const svc = createServiceRoleSupabase();

  const url = buildTrackingUrl(input.carrier, input.trackingNumber);
  const { data: updated, error } = await svc
    .from('orders')
    .update({
      ship_status: 'shipped',
      shipped_at: new Date().toISOString(),
      tracking_carrier: input.carrier,
      tracking_number: input.trackingNumber,
      tracking_url: url,
      estimated_delivery_date: input.estimatedDeliveryDate ?? null,
      notes_to_buyer: input.notesToBuyer ?? null,
    })
    .eq('id', input.orderId)
    .select('id, customer_email, locale, number')
    .single();
  if (error || !updated) return { error: error?.message ?? 'Update failed' };

  await svc.from('order_events').insert({
    order_id: updated.id,
    type: 'order.shipped',
    payload: { carrier: input.carrier, number: input.trackingNumber, url },
    actor: 'owner',
  });

  await sendEmail({
    to: updated.customer_email,
    subject: `Your order ${updated.number} is on the way`,
    react: OrderShipped({
      orderNumber: updated.number,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      trackingUrl: url,
      orderUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/${updated.locale}/order/${updated.id}?t=${signOrderToken(updated.id, updated.customer_email)}`,
    }),
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${input.orderId}`);
  return { ok: true as const };
}
```

Commit.

---

## Task 9: Admin orders list

**Files:** `src/app/admin/orders/page.tsx`, `src/components/admin/OrdersTable.tsx`, `src/server/queries/admin-orders.ts`

List shows: number, customer email, status pill, ship status pill, total, created_at; filter by status. Commit.

---

## Task 10: Admin orders detail + ship form

**Files:** `src/app/admin/orders/[id]/page.tsx`, `src/components/admin/ShipOrderForm.tsx`

Detail shows: line items, shipping address, payment trail, audit events; ship form is hidden once `ship_status='shipped'`. Commit.

---

## Task 11: Discount admin (list + form + actions)

**Files:** `src/app/admin/discounts/{page,new/page,[id]/edit/page}.tsx`, `src/components/admin/DiscountForm.tsx`, `src/server/actions/discounts.ts`

Similar shape to products admin. Code uppercase, kind = fixed/percent, validity window, max uses. Commit.

---

## Task 12: Waitlist join button on PDP

**Files:** `src/components/shop/WaitlistButton.tsx`, `src/app/api/waitlist/route.ts`

Replaces "Out of stock" CTA with an email-input form. POSTs to `/api/waitlist` which validates email + inserts. Commit.

---

## Task 13: Admin waitlists list

**Files:** `src/app/admin/waitlists/page.tsx`, `src/components/admin/WaitlistsTable.tsx`, `src/server/queries/admin-waitlists.ts`

Group entries by variant; show count + earliest waiter + variant stock. Commit.

---

## Task 14: Cron — release stale awaiting_payment

**Files:** `src/app/api/cron/release-stale/route.ts`

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { STALE_HOLD_MINUTES } from '@/domain/stale-orders';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const svc = createServiceRoleSupabase();
  const cutoff = new Date(Date.now() - STALE_HOLD_MINUTES * 60_000).toISOString();
  const { data: stale } = await svc
    .from('orders')
    .select('id')
    .eq('status', 'awaiting_payment')
    .lt('created_at', cutoff);
  let released = 0;
  for (const o of stale ?? []) {
    const { data: items } = await svc.from('order_items').select('variant_id, qty').eq('order_id', o.id);
    for (const it of items ?? []) {
      if (!it.variant_id) continue;
      const { data: v } = await svc.from('variants').select('stock_available, stock_reserved').eq('id', it.variant_id).maybeSingle();
      if (v) {
        await svc.from('variants').update({
          stock_available: v.stock_available + it.qty,
          stock_reserved: Math.max(0, v.stock_reserved - it.qty),
        }).eq('id', it.variant_id);
      }
    }
    await svc.from('orders').update({ status: 'cancelled' }).eq('id', o.id);
    await svc.from('order_events').insert({
      order_id: o.id, type: 'order.cancelled_stale', payload: { reason: 'hold_expired' }, actor: 'system',
    });
    released++;
  }
  return NextResponse.json({ ok: true, released });
}
```

Commit.

---

## Task 15: Cron — notify waitlists on restock

**Files:** `src/app/api/cron/notify-waitlist/route.ts`

For each variant with `stock_available > 0` AND pending waitlist entries, email up to 20 oldest waiters using `WaitlistRestock`. Mark `notified_at`. Commit.

---

## Task 16: Vercel cron config

**Files:** `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/release-stale", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/notify-waitlist", "schedule": "0 * * * *" }
  ]
}
```

Commit.

---

## Task 17: Admin nav additions

**Files:** modify `src/components/admin/AdminNav.tsx`

Add links: Orders, Discounts, Waitlists. Commit.

---

## Task 18: README + final gate

Update README with: Resend setup, cron setup (`CRON_SECRET` env var), demo flow for shipping. Run full gate. Commit.

---

## Out of scope for Plan 4 (later)

| Concern | Plan |
|---|---|
| Google Sheets two-way sync + dev-only screens | Plan 5 |
| Real PSP integration (FFP / Opn / Stripe) | Plan 6 |
| Motion + security headers + Turnstile + E2E + production deploy | Plan 6 |
| Customer accounts (currently guest-only via signed token) | Plan 6 |
| Rate limiting on waitlist + discount lookup | Plan 6 |
