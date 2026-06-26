# rb_shop — Plan 3: Checkout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end purchase flow with cart, guest checkout, mock-payment confirmation, order lifecycle, shipping timeline, and printable receipt. End state: a fan can add items to cart, fill the checkout form, simulate payment success/failure via the mock provider, and land on an order page with a Soft-Studio shipping timeline; rainbykello sees the order in admin (Plan 4 ships full admin orders UI — this plan ships a basic detail view + the receipt).

**Architecture:**
- **Payment behind an interface** — `domain/payment/PaymentProvider.ts` defines `createCharge`, `verifyNotification`, `reconcile`. v1 ships only a `MockProvider` adapter. FFP/Opn/Stripe plug in later behind the same interface (Plan 6 or beyond).
- **Server-side ordering** — `server/actions/orders.ts::placeOrder` validates the cart against current DB prices + stock, atomically reserves stock, creates the `orders` row with `awaiting_payment`, then asks the provider to create a charge.
- **Notification idempotency** — `/api/payments/notify/[providerKey]` verifies the signature, dedupes via `orders.last_event_id`, and transitions the order on success.
- **Cart on the client** — `localStorage` only (guest checkout is the primary v1 flow; D5 LOCKED). Cart state is variant id + qty only; prices and product copy are fetched server-side at checkout time so the cart can't be tampered with.
- **Receipt** — `/[locale]/order/[id]/receipt` is a server-rendered, print-styled HTML page. Browser print-to-PDF only — no server PDF lib.
- **Shipping timeline** — buyer-visible vertical timeline on `/order/[id]`. Status: `pending → preparing → shipped → delivered`. Owner sets shipped + tracking from admin (in this plan we ship the buyer-visible view; the admin shipping form lands in Plan 4 with the orders admin UI).

**Tech stack additions:** `nanoid` (random order numbers + reference codes), `zustand` (cart store) — both small, no recurring cost.

**Spec reference:** spec §3.2 (data flow), §4 orders schema, §6.1–6.3 (checkout + shipping + receipt flows), §6.6/6.7 (receipt + timeline UX), §7.4 (motion).

**Locked decisions for this plan:**
- Cart UI: **right-sliding drawer** (spec §7.4) + a full `/cart` page for clarity.
- Cart persistence: **localStorage only** for v1 (D5 LOCKED).
- Guest order lookup: **signed permalink token on `/order/[id]?t=…`** (D6 LOCKED — magic link by token, no account required).
- Payment: **MockProvider only** in this plan. Real PSP per spec §10 Phase 2 gate.
- Shipping cost model: **flat per zone** (D3 LOCKED). Default seed: TH ฿60 / SEA ฿280 / Worldwide ฿650.
- Order number format: **10-char base32 (Crockford) + 2-char check digit** (non-enumerable).
- Receipt approach: **browser print-to-PDF via `@media print` styles**, no server PDF.

---

## File structure built by this plan

```
rb_shop/
├── messages/
│   ├── th.json                                  (+ cart, checkout, order, receipt keys)
│   └── en.json                                  (+ cart, checkout, order, receipt keys)
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── cart/page.tsx                    (full cart page)
│   │   │   ├── checkout/page.tsx                (address form + summary)
│   │   │   ├── checkout/pay/[order]/page.tsx    (mock-payment simulator)
│   │   │   └── order/[id]/
│   │   │       ├── page.tsx                     (order detail + timeline)
│   │   │       └── receipt/page.tsx             (printable receipt)
│   │   ├── api/
│   │   │   └── payments/notify/[provider]/route.ts
│   ├── components/
│   │   ├── cart/
│   │   │   ├── CartDrawer.tsx
│   │   │   ├── CartContents.tsx
│   │   │   ├── AddToCartButton.tsx              (replaces stub on PDP)
│   │   │   └── CartIcon.tsx                     (header indicator + open drawer)
│   │   ├── checkout/
│   │   │   ├── CheckoutForm.tsx
│   │   │   └── OrderSummary.tsx
│   │   └── order/
│   │       ├── ShippingTimeline.tsx
│   │       └── ReceiptDoc.tsx
│   ├── domain/
│   │   ├── order-number.ts                      (NEW, TDD — random + check digit)
│   │   └── payment/
│   │       ├── PaymentProvider.ts               (interface)
│   │       ├── ChargeInput.ts                   (types)
│   │       └── adapters/
│   │           └── MockProvider.ts              (dev-only signed sim)
│   ├── lib/
│   │   ├── cart-store.ts                        (zustand store, localStorage-persisted)
│   │   └── order-token.ts                       (HMAC-signed guest order tokens, TDD)
│   ├── server/
│   │   ├── actions/
│   │   │   └── orders.ts                        (placeOrder + reconcileOrder)
│   │   └── queries/
│   │       └── orders.ts                        (getOrderForGuest, getOrderForOwner)
│   └── supabase/migrations/
│       ├── 20260627001000_orders.sql            (orders, items, events, discount codes, shipping zones)
│       ├── 20260627001100_orders_rls.sql        (RLS + grants)
│       └── 20260627001200_orders_seed.sql       (default shipping zones)
└── tests/
    ├── unit/
    │   ├── domain/
    │   │   ├── order-number.test.ts
    │   │   └── payment/mock.test.ts
    │   └── lib/
    │       └── order-token.test.ts
```

---

## Conventions (carry-over)

- Branch: `develop`. Commit per task.
- Bun for everything; Node for `next build` (driven by package.json `build` script).
- `import * as z from 'zod'`.
- Biome v2 strict; LF line endings.
- TDD for `order-number`, `order-token`, and `MockProvider`. UI verified by build + manual smoke.
- Every catalog/order migration adds explicit `service_role` grants — Plan 1 lesson, never skipped.

---

## Task 1: Migration — orders, items, events, discounts, shipping_zones

**Files:**
- Create: `supabase/migrations/20260627001000_orders.sql`

- [ ] **Step 1: Write migration**

```sql
create type public.order_status as enum (
  'awaiting_payment',
  'paid',
  'failed',
  'cancelled',
  'refunded'
);

create type public.ship_status as enum (
  'pending',
  'preparing',
  'shipped',
  'delivered'
);

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name jsonb not null,
  countries text[] not null,
  flat_rate_thb int not null check (flat_rate_thb >= 0),
  is_active boolean not null default true,
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shipping_zones_set_updated_at
before update on public.shipping_zones
for each row execute function public.set_updated_at();

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('fixed','percent')),
  value int not null check (value >= 0),
  min_subtotal_thb int not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_uses int,
  uses int not null default 0,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger discount_codes_set_updated_at
before update on public.discount_codes
for each row execute function public.set_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,           -- non-enumerable Crockford base32 + check digit
  customer_email text not null,
  customer_id uuid references auth.users(id) on delete set null,
  status public.order_status not null default 'awaiting_payment',
  subtotal_thb int not null check (subtotal_thb >= 0),
  discount_thb int not null default 0 check (discount_thb >= 0),
  shipping_thb int not null default 0 check (shipping_thb >= 0),
  total_thb int not null check (total_thb >= 0),
  currency text not null default 'THB',
  locale text not null check (locale in ('th','en')),
  shipping_address jsonb not null,
  payment_provider text not null,
  payment_method text,
  payment_charge_id text,
  last_event_id text,
  paid_at timestamptz,
  ship_status public.ship_status not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  tracking_carrier text,
  tracking_number text,
  tracking_url text,
  estimated_delivery_date date,
  notes_internal text,
  notes_to_buyer text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_status_idx on public.orders(status);
create index orders_customer_email_idx on public.orders(customer_email);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete set null,
  qty int not null check (qty > 0),
  unit_price_thb int not null check (unit_price_thb >= 0),
  line_total_thb int not null check (line_total_thb >= 0),
  product_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor text not null,                   -- 'system' | 'customer:<id>' | 'owner:<id>' | 'dev:<id>'
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events(order_id, created_at);
```

- [ ] **Step 2: Apply**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/supabase db reset 2>&1 | tail -8"
```

- [ ] **Step 3: Re-bootstrap dev user**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run /tmp/bootstrap-dev.ts && ~/.bun/bin/bun run grant:dev -- eightsbinary@gmail.com"
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(db): orders, items, events, discount_codes, shipping_zones"
```

---

## Task 2: Migration — RLS + grants for order tables

**Files:**
- Create: `supabase/migrations/20260627001100_orders_rls.sql`, `supabase/policies/orders.sql`

- [ ] **Step 1: Write migration**

```sql
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.discount_codes enable row level security;
alter table public.shipping_zones enable row level security;

-- Anyone can read active shipping zones (storefront needs them for quote calc)
create policy "shipping_zones_public_read"
on public.shipping_zones for select
to anon, authenticated
using (is_active);

create policy "shipping_zones_owner_dev_all"
on public.shipping_zones for all
to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Discount codes: never select via PostgREST.
-- A future SECURITY DEFINER fn handles code lookup with rate limiting.
create policy "discount_codes_owner_dev_all"
on public.discount_codes for all
to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Orders: customer can read own (by customer_id once logged in);
-- guest reads go through a signed-token RPC (added in Task 8).
create policy "orders_self_select"
on public.orders for select
to authenticated
using (customer_id = auth.uid());

create policy "orders_owner_dev_all"
on public.orders for all
to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

create policy "order_items_via_parent_select"
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.customer_id = auth.uid() or public.is_owner_or_dev())
  )
);

create policy "order_items_owner_dev_all"
on public.order_items for all
to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

create policy "order_events_owner_dev_select"
on public.order_events for select
to authenticated
using (public.is_owner_or_dev());

-- Grants
grant select on public.shipping_zones to anon, authenticated;
grant select, insert, update, delete
  on public.shipping_zones, public.discount_codes,
     public.orders, public.order_items, public.order_events
  to service_role;

grant select, insert, update, delete
  on public.shipping_zones, public.discount_codes,
     public.orders, public.order_items, public.order_events
  to authenticated;
```

- [ ] **Step 2: Mirror to `supabase/policies/orders.sql`** (same content)

- [ ] **Step 3: Apply + re-bootstrap dev**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(db): RLS + grants for orders, items, events, discounts, zones"
```

---

## Task 3: Migration — seed default shipping zones

**Files:**
- Create: `supabase/migrations/20260627001200_orders_seed.sql`

- [ ] **Step 1: Write migration**

```sql
insert into public.shipping_zones (code, name, countries, flat_rate_thb, sort)
values
  ('TH',  jsonb_build_object('th','ในประเทศ',     'en','Thailand'),       array['TH'],                                            60,  0),
  ('SEA', jsonb_build_object('th','เอเชียตะวันออกเฉียงใต้','en','Southeast Asia'), array['MY','SG','ID','VN','PH'],                280, 10),
  ('WW',  jsonb_build_object('th','ทั่วโลก',       'en','Worldwide'),      array['*'],                                            650, 20)
on conflict (code) do nothing;
```

- [ ] **Step 2: Apply + commit**

```bash
git commit -m "feat(db): seed TH / SEA / Worldwide shipping zones"
```

---

## Task 4: Regenerate types

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run db:types"
git commit -m "chore(db): regenerate types for orders + shipping + discount"
```

---

## Task 5: Domain — `order-number` (TDD)

**Files:** `src/domain/order-number.ts`, `tests/unit/domain/order-number.test.ts`

Crockford base32 alphabet (no I, L, O, U) + Luhn-style mod check digit. Non-enumerable; safe to print on a receipt.

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it } from 'vitest';
import { generateOrderNumber, isValidOrderNumber } from '@/domain/order-number';

describe('order-number', () => {
  it('returns a 12-char string from the Crockford alphabet', () => {
    const n = generateOrderNumber();
    expect(n).toHaveLength(12);
    expect(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/.test(n)).toBe(true);
  });

  it('round-trips: generated numbers pass validation', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidOrderNumber(generateOrderNumber())).toBe(true);
    }
  });

  it('rejects tampered numbers (single char swap)', () => {
    const n = generateOrderNumber();
    const swapped = `${n.slice(0, 5)}${n[5] === '0' ? '1' : '0'}${n.slice(6)}`;
    expect(isValidOrderNumber(swapped)).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidOrderNumber('TOO-SHORT')).toBe(false);
    expect(isValidOrderNumber('OOOOOOOOOOOO')).toBe(false); // O not in alphabet
  });
});
```

- [ ] **Step 2: Implementation**

```ts
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PAYLOAD_LEN = 10;

function checkDigit(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const v = ALPHABET.indexOf(payload[i] ?? '');
    if (v < 0) throw new Error('invalid char');
    sum = (sum + v * (i + 1)) % ALPHABET.length;
  }
  return ALPHABET[sum] ?? '0';
}

export function generateOrderNumber(): string {
  let payload = '';
  for (let i = 0; i < PAYLOAD_LEN; i++) {
    payload += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${payload}${checkDigit(payload)}${checkDigit(payload + checkDigit(payload))}`;
}

export function isValidOrderNumber(input: string): boolean {
  if (!/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/.test(input)) return false;
  const payload = input.slice(0, PAYLOAD_LEN);
  const d1 = input[PAYLOAD_LEN];
  const d2 = input[PAYLOAD_LEN + 1];
  const expected1 = checkDigit(payload);
  if (d1 !== expected1) return false;
  const expected2 = checkDigit(payload + expected1);
  return d2 === expected2;
}
```

- [ ] **Step 3: `bun run test` → all pass → commit**

```bash
git commit -m "feat(domain): order-number generator (Crockford base32 + 2-char check)"
```

---

## Task 6: Library — order-token (HMAC, TDD)

**Files:** `src/lib/order-token.ts`, `tests/unit/lib/order-token.test.ts`

Guest order lookup uses a token signed with `SUPABASE_SERVICE_ROLE_KEY` (server-only). The token is `base64url(orderId + "." + hmac(orderId))`. Token is bound to the order's `customer_email` so re-issuing on email rotation invalidates old links.

- [ ] **Step 1: Tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { signOrderToken, verifyOrderToken } from '@/lib/order-token';

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-please-change';
});

describe('order-token', () => {
  it('signs and verifies a token bound to (orderId, email)', () => {
    const token = signOrderToken('order-1', 'fan@example.com');
    expect(verifyOrderToken(token, 'order-1', 'fan@example.com')).toBe(true);
  });

  it('rejects token bound to a different email', () => {
    const token = signOrderToken('order-1', 'fan@example.com');
    expect(verifyOrderToken(token, 'order-1', 'someone@else.com')).toBe(false);
  });

  it('rejects token bound to a different order', () => {
    const token = signOrderToken('order-1', 'fan@example.com');
    expect(verifyOrderToken(token, 'order-2', 'fan@example.com')).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(verifyOrderToken('not-a-token', 'order-1', 'fan@example.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Implementation**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return key;
}

function digest(input: string): string {
  return createHmac('sha256', secret()).update(input).digest('base64url');
}

export function signOrderToken(orderId: string, email: string): string {
  const payload = `${orderId}|${email.toLowerCase()}`;
  return `${Buffer.from(payload).toString('base64url')}.${digest(payload)}`;
}

export function verifyOrderToken(token: string, orderId: string, email: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;
  let payload: string;
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const [tokenOrderId, tokenEmail] = payload.split('|');
  if (tokenOrderId !== orderId) return false;
  if (tokenEmail !== email.toLowerCase()) return false;
  const expected = digest(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 3: Test + commit**

```bash
git commit -m "feat(lib): HMAC-signed order tokens for guest order lookup"
```

---

## Task 7: Payment provider interface + types

**Files:**
- Create: `src/domain/payment/ChargeInput.ts`, `src/domain/payment/PaymentProvider.ts`

- [ ] **Step 1: `ChargeInput.ts`**

```ts
export type PaymentMethodKind = 'card' | 'promptpay' | 'mobile_banking' | 'mock';

export interface ChargeInput {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amountThb: number;
  readonly currency: 'THB';
  readonly method: PaymentMethodKind;
  readonly returnUrl: string;
  readonly notifyUrl: string;
  readonly customerEmail: string;
}

export interface ChargeHandle {
  readonly chargeId: string;
  readonly redirectUrl?: string;
  readonly qrPayload?: string;
}

export type ChargeStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface VerifiedEvent {
  readonly eventId: string;
  readonly orderId: string;
  readonly chargeId: string;
  readonly status: ChargeStatus;
  readonly amountThb: number;
}
```

- [ ] **Step 2: `PaymentProvider.ts`**

```ts
import type { ChargeHandle, ChargeInput, ChargeStatus, VerifiedEvent } from './ChargeInput';

export interface PaymentProvider {
  readonly key: string;
  createCharge(input: ChargeInput): Promise<ChargeHandle>;
  verifyNotification(req: Request): Promise<VerifiedEvent>;
  reconcile(chargeId: string): Promise<ChargeStatus>;
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(domain): PaymentProvider interface + ChargeInput/Handle/Event types"
```

---

## Task 8: Mock payment adapter (TDD)

**Files:**
- Create: `src/domain/payment/adapters/MockProvider.ts`, `tests/unit/domain/payment/mock.test.ts`

The mock provider:
- Returns a `chargeId = mock_<random>` and a `redirectUrl = /[locale]/checkout/pay/<orderId>` from `createCharge`.
- Verifies notifications signed with a dev-only secret via HMAC.
- `reconcile` returns whatever the in-memory map says — but since the mock simulator pings the notification endpoint directly, the production code only ever sees the verified event path.
- **Hard-disabled in production builds** (`if (process.env.NODE_ENV === 'production' && !process.env.RB_SHOP_ALLOW_MOCK) throw`).

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it } from 'vitest';
import { MockProvider, signMockEvent } from '@/domain/payment/adapters/MockProvider';

const provider = new MockProvider();

describe('MockProvider', () => {
  it('creates a charge with a redirect URL', async () => {
    const handle = await provider.createCharge({
      orderId: 'o1', orderNumber: 'AAA',
      amountThb: 100, currency: 'THB', method: 'mock',
      returnUrl: 'http://x/return', notifyUrl: 'http://x/notify',
      customerEmail: 'a@b.c',
    });
    expect(handle.chargeId).toMatch(/^mock_/);
    expect(handle.redirectUrl).toContain('o1');
  });

  it('verifies a valid signed notification', async () => {
    const body = JSON.stringify({
      eventId: 'evt-1', orderId: 'o1', chargeId: 'mock_c1',
      status: 'paid', amountThb: 100,
    });
    const sig = signMockEvent(body);
    const req = new Request('http://x', {
      method: 'POST', body, headers: { 'x-mock-signature': sig },
    });
    const ev = await provider.verifyNotification(req);
    expect(ev.status).toBe('paid');
    expect(ev.orderId).toBe('o1');
  });

  it('rejects unsigned notifications', async () => {
    const req = new Request('http://x', { method: 'POST', body: '{}' });
    await expect(provider.verifyNotification(req)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Implementation**

```ts
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  ChargeHandle, ChargeInput, ChargeStatus, VerifiedEvent,
} from '../ChargeInput';
import type { PaymentProvider } from '../PaymentProvider';

const MOCK_SECRET = process.env.RB_SHOP_MOCK_SECRET ?? 'dev-mock-secret';

export function signMockEvent(body: string): string {
  return createHmac('sha256', MOCK_SECRET).update(body).digest('base64url');
}

export class MockProvider implements PaymentProvider {
  readonly key = 'mock';

  constructor() {
    if (process.env.NODE_ENV === 'production' && !process.env.RB_SHOP_ALLOW_MOCK) {
      throw new Error('MockProvider is disabled in production');
    }
  }

  async createCharge(input: ChargeInput): Promise<ChargeHandle> {
    const chargeId = `mock_${randomBytes(8).toString('hex')}`;
    // The simulator UI lives at /checkout/pay/[orderId] — the route reads orderId.
    return {
      chargeId,
      redirectUrl: `/checkout/pay/${input.orderId}?cid=${chargeId}`,
    };
  }

  async verifyNotification(req: Request): Promise<VerifiedEvent> {
    const sig = req.headers.get('x-mock-signature');
    if (!sig) throw new Error('Missing signature');
    const body = await req.text();
    const expected = signMockEvent(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid signature');
    }
    const parsed = JSON.parse(body) as VerifiedEvent;
    return parsed;
  }

  async reconcile(_chargeId: string): Promise<ChargeStatus> {
    // Mock provider has no out-of-band state — assume the notification is canon.
    return 'pending';
  }
}
```

- [ ] **Step 3: Test + commit**

```bash
git commit -m "feat(domain): MockProvider with HMAC-verified notifications"
```

---

## Task 9: Cart store (zustand + localStorage)

**Files:** install zustand; `src/lib/cart-store.ts`

The store keeps `{ variantId, qty }[]`. Prices come from the server at checkout, not the client — so a tampered localStorage can't underpay.

- [ ] **Step 1: Install**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun add zustand"
```

- [ ] **Step 2: Implement**

```ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  variantId: string;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  open: boolean;
  setOpen(open: boolean): void;
  add(line: CartLine): void;
  setQty(variantId: string, qty: number): void;
  remove(variantId: string): void;
  clear(): void;
  count(): number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: ({ variantId, qty }) =>
        set((s) => {
          const existing = s.lines.find((l) => l.variantId === variantId);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.variantId === variantId ? { ...l, qty: l.qty + qty } : l,
              ),
            };
          }
          return { lines: [...s.lines, { variantId, qty }] };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.variantId !== variantId)
              : s.lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
        })),
      remove: (variantId) =>
        set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((acc, l) => acc + l.qty, 0),
    }),
    { name: 'rb_shop_cart' },
  ),
);
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cart): zustand store persisted to localStorage"
```

---

## Task 10: Add-to-cart wired on PDP

**Files:**
- Create: `src/components/cart/AddToCartButton.tsx`
- Modify: `src/components/shop/VariantSelector.tsx` — replace the static button with `AddToCartButton`

- [ ] **Step 1: `AddToCartButton.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/cart-store';

export function AddToCartButton({
  variantId,
  disabled,
  outOfStock,
}: {
  variantId: string | null;
  disabled: boolean;
  outOfStock: boolean;
}) {
  const t = useTranslations('pdp');
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={disabled || pending || !variantId}
      onClick={() => {
        if (!variantId) return;
        setPending(true);
        add({ variantId, qty: 1 });
        setOpen(true);
        setTimeout(() => setPending(false), 220);
      }}
    >
      {!variantId ? t('selectSize') : outOfStock ? t('outOfStock') : t('addToCart')}
    </Button>
  );
}
```

- [ ] **Step 2: Wire into `VariantSelector.tsx`** — replace the inline Button with `<AddToCartButton variantId={matched?.id ?? null} disabled={!ready || !inStock} outOfStock={ready && !inStock} />`. Pass `id` through the matched variant.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cart): wire add-to-cart on PDP variant selector"
```

---

## Task 11: Cart drawer + icon in header

**Files:**
- Create: `src/components/cart/CartDrawer.tsx`, `src/components/cart/CartContents.tsx`, `src/components/cart/CartIcon.tsx`
- Modify: `src/components/shop/Header.tsx` — add `<CartIcon />` to the nav row
- Modify: `src/app/[locale]/layout.tsx` — render `<CartDrawer />` at the end so it's mounted globally

`CartIcon` shows count + opens drawer. `CartDrawer` slides in from the right with 260 ms cubic-bezier per spec §7.4. `CartContents` lists lines with qty bumpers + remove + checkout CTA.

- [ ] **Step 1: `CartIcon.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';

export function CartIcon() {
  const count = useCart((s) => s.count());
  const setOpen = useCart((s) => s.setOpen);
  // SSR-safe count display (avoid hydration mismatch on first render)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-sm text-ink-soft hover:text-ink transition-colors duration-150 ease-out-soft"
      aria-label="Open cart"
    >
      cart {mounted ? `(${count})` : ''}
    </button>
  );
}
```

- [ ] **Step 2: `CartContents.tsx`** — for v1 keep it simple: list `lines`, qty +/-, remove, "Checkout" link. We fetch product display info from `/api/cart/preview` (added in Task 13). For now display variantId; we'll replace with product names in Task 13.

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/cart-store';

export function CartContents() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setOpen = useCart((s) => s.setOpen);

  if (lines.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 space-y-4 overflow-y-auto">
        {lines.map((l) => (
          <li key={l.variantId} className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">{l.variantId}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty(l.variantId, l.qty - 1)} className="h-8 w-8 rounded border border-line">−</button>
              <span className="w-6 text-center">{l.qty}</span>
              <button type="button" onClick={() => setQty(l.variantId, l.qty + 1)} className="h-8 w-8 rounded border border-line">+</button>
              <button type="button" onClick={() => remove(l.variantId)} className="text-muted hover:text-error text-sm">×</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="pt-4">
        <Link href={`/${locale}/checkout`} onClick={() => setOpen(false)}>
          <Button className="w-full">{t('checkout')}</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `CartDrawer.tsx`** — slide-in right with scrim, ESC closes.

```tsx
'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/cart-store';
import { CartContents } from './CartContents';

export function CartDrawer() {
  const open = useCart((s) => s.open);
  const setOpen = useCart((s) => s.setOpen);
  const t = useTranslations('cart');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-220 ease-out-soft ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        role="dialog"
        aria-label="Cart"
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-paper p-6 shadow-xl transition-transform duration-260 ease-out-soft ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between pb-4">
          <h2 className="font-serif text-2xl text-ink">{t('title')}</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Close cart">×</button>
        </header>
        <CartContents />
      </aside>
    </>
  );
}
```

- [ ] **Step 4: Mount drawer in `[locale]/layout.tsx`** (add `<CartDrawer />` after `<Footer />`).

- [ ] **Step 5: Wire `<CartIcon />` into `Header.tsx`** (after the shop link).

- [ ] **Step 6: Extend message files** — add `cart` namespace (`title`, `empty`, `checkout`) in both `messages/th.json` and `messages/en.json`.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(cart): right-slide drawer + header cart icon"
```

---

## Task 12: Cart preview server query

**Files:** Create: `src/server/queries/cart.ts`. The cart store only holds variant ids; the storefront PDP/cart drawer/checkout needs product names, prices, stock to display safely.

```ts
import 'server-only';
import { createServerSupabase } from '@/db/server';

export interface CartPreviewLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: { th?: string; en?: string };
  optionValues: Record<string, string>;
  unitPriceThb: number;
  imageUrl: string | null;
  stockAvailable: number;
}

export async function previewCart(variantIds: string[]): Promise<CartPreviewLine[]> {
  if (variantIds.length === 0) return [];
  const supa = await createServerSupabase();
  const { data, error } = await supa
    .from('variants')
    .select(
      `id, option_values, price_thb, stock_available, is_active,
       product:products!inner(id, slug, name, base_price_thb, status,
         hero_image:product_images!products_hero_image_fk(url_400))`,
    )
    .in('id', variantIds);
  if (error || !data) return [];
  return data
    .filter((v) => v.is_active)
    .map((v) => {
      const p = Array.isArray(v.product) ? v.product[0] : v.product;
      if (!p || p.status !== 'active') return null;
      const hero = Array.isArray(p.hero_image) ? p.hero_image[0] : p.hero_image;
      return {
        variantId: v.id,
        productId: p.id,
        productSlug: p.slug,
        productName: p.name as { th?: string; en?: string },
        optionValues: v.option_values as Record<string, string>,
        unitPriceThb: v.price_thb ?? p.base_price_thb,
        imageUrl: hero?.url_400 ?? null,
        stockAvailable: v.stock_available,
      };
    })
    .filter((l): l is CartPreviewLine => l !== null);
}
```

Add an internal route `/api/cart/preview` that calls this so the client drawer can fetch product info. Then the drawer renders names + prices instead of bare variant ids.

- [ ] **Step 1: Write query + route** (`src/app/api/cart/preview/route.ts` — POST `{ ids: string[] }`, returns `CartPreviewLine[]`).

- [ ] **Step 2: Update `CartContents.tsx`** to fetch via the new route on mount.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cart): server-side preview (name + price + image) for cart drawer"
```

---

## Task 13: `/cart` full page

**Files:** Create: `src/app/[locale]/cart/page.tsx`. Same data shape as the drawer; lays out as a 2-column page with line items left + summary right.

- [ ] **Step 1: Implement** as a client component (since cart lives in zustand). Reuse `CartContents` styling.
- [ ] **Step 2: Commit**

```bash
git commit -m "feat(cart): /cart full-page view"
```

---

## Task 14: Checkout form + order summary

**Files:**
- Create: `src/components/checkout/CheckoutForm.tsx`, `src/components/checkout/OrderSummary.tsx`, `src/app/[locale]/checkout/page.tsx`
- Server query: load active shipping zones server-side, pass to client form

- [ ] **Step 1: `CheckoutForm.tsx`** (client) — name, email, address, country select; on submit it POSTs cart `{lines, country, discountCode?}` to `placeOrder` action. Calls `useCart().clear()` and redirects to the returned `redirectUrl`.

- [ ] **Step 2: `OrderSummary.tsx`** — client component, recomputes shown subtotal/shipping/total on the fly using cart preview prices. **The real authoritative numbers come from the server action.** This summary is display only — the server recomputes everything.

- [ ] **Step 3: Checkout page** — server component that:
  - Reads variant ids from a `?lines=…` query param OR redirects to /cart if empty (cart is client-only; we can also hydrate from localStorage via an `useEffect` redirect — accept the client-only nature).
  - Loads `previewCart(ids)` + `listShippingZones()` and renders the form/summary.

For v1 we'll have the page be a client component that reads from `useCart()` directly, calls `/api/cart/preview` for product names, and loads zones via `/api/shipping/zones`. Cleaner than juggling query params.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(checkout): form + order summary at /[locale]/checkout"
```

---

## Task 15: `placeOrder` server action

**Files:** `src/server/actions/orders.ts`

```ts
'use server';

import { headers } from 'next/headers';
import * as z from 'zod';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { generateOrderNumber } from '@/domain/order-number';
import { MockProvider } from '@/domain/payment/adapters/MockProvider';
import { signOrderToken } from '@/lib/order-token';

const ShippingAddress = z.object({
  fullName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  phone: z.string().optional(),
});

const PlaceOrderInput = z.object({
  email: z.string().email(),
  locale: z.enum(['th', 'en']),
  address: ShippingAddress,
  lines: z.array(z.object({ variantId: z.string().uuid(), qty: z.number().int().positive() })),
  discountCode: z.string().optional(),
});

export type PlaceOrderInputT = z.infer<typeof PlaceOrderInput>;

export async function placeOrder(raw: PlaceOrderInputT) {
  const input = PlaceOrderInput.parse(raw);
  const supa = createServiceRoleSupabase();

  // 1) Load variants + their products in one go
  const { data: variants, error: vErr } = await supa
    .from('variants')
    .select(
      'id, price_thb, stock_available, stock_reserved, is_active, option_values, product:products!inner(id, slug, name, base_price_thb, status, weight_grams)',
    )
    .in('id', input.lines.map((l) => l.variantId));
  if (vErr || !variants) return { error: 'Could not load cart' };

  // 2) Validate
  let subtotal = 0;
  const itemRows: Array<Record<string, unknown>> = [];
  for (const line of input.lines) {
    const v = variants.find((x) => x.id === line.variantId);
    if (!v || !v.is_active) return { error: `Variant ${line.variantId} unavailable` };
    const p = Array.isArray(v.product) ? v.product[0] : v.product;
    if (!p || p.status !== 'active') return { error: 'Product unavailable' };
    if (v.stock_available < line.qty) return { error: 'Not enough stock' };
    const unit = v.price_thb ?? p.base_price_thb;
    const lineTotal = unit * line.qty;
    subtotal += lineTotal;
    itemRows.push({
      variant_id: v.id,
      qty: line.qty,
      unit_price_thb: unit,
      line_total_thb: lineTotal,
      product_snapshot: {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        optionValues: v.option_values,
      },
    });
  }

  // 3) Resolve shipping zone
  const { data: zones } = await supa
    .from('shipping_zones')
    .select('*')
    .eq('is_active', true)
    .order('sort');
  if (!zones || zones.length === 0) return { error: 'No shipping zones configured' };
  const zone =
    zones.find((z) => z.countries.includes(input.address.country)) ??
    zones.find((z) => z.countries.includes('*'));
  if (!zone) return { error: 'No shipping zone matches your country' };

  // 4) Discount lookup (no rate-limit yet — Plan 6 hardens)
  let discount = 0;
  if (input.discountCode) {
    const { data: codeRow } = await supa
      .from('discount_codes')
      .select('*')
      .eq('code', input.discountCode)
      .eq('active', true)
      .maybeSingle();
    if (codeRow) {
      const now = new Date();
      if (now >= new Date(codeRow.starts_at) && now <= new Date(codeRow.ends_at)) {
        if (subtotal / 100 >= codeRow.min_subtotal_thb) {
          discount =
            codeRow.kind === 'fixed'
              ? codeRow.value
              : Math.floor((subtotal * codeRow.value) / 100);
        }
      }
    }
  }
  if (discount > subtotal) discount = subtotal;
  const total = subtotal - discount + zone.flat_rate_thb;

  // 5) Reserve stock + create order in a transaction-like sequence
  // (Supabase JS doesn't expose multi-statement transactions; we do best-effort.)
  for (const line of input.lines) {
    const v = variants.find((x) => x.id === line.variantId);
    if (!v) continue;
    const { error: updErr } = await supa
      .from('variants')
      .update({
        stock_available: v.stock_available - line.qty,
        stock_reserved: v.stock_reserved + line.qty,
      })
      .eq('id', v.id)
      .gte('stock_available', line.qty);
    if (updErr) return { error: 'Reservation failed' };
  }

  const number = generateOrderNumber();
  const { data: order, error: oErr } = await supa
    .from('orders')
    .insert({
      number,
      customer_email: input.email,
      status: 'awaiting_payment',
      subtotal_thb: subtotal,
      discount_thb: discount,
      shipping_thb: zone.flat_rate_thb,
      total_thb: total,
      locale: input.locale,
      shipping_address: input.address,
      payment_provider: 'mock',
    })
    .select('id, number')
    .single();
  if (oErr || !order) return { error: 'Could not create order' };

  await supa.from('order_items').insert(
    itemRows.map((row) => ({ ...row, order_id: order.id })),
  );
  await supa.from('order_events').insert({
    order_id: order.id,
    type: 'order.created',
    payload: { lines: input.lines.length, total },
    actor: 'system',
  });

  // 6) Hand to provider
  const h = await headers();
  const origin = h.get('origin') ?? 'http://localhost:3000';
  const provider = new MockProvider();
  const handle = await provider.createCharge({
    orderId: order.id,
    orderNumber: order.number,
    amountThb: total,
    currency: 'THB',
    method: 'mock',
    returnUrl: `${origin}/${input.locale}/order/${order.id}?t=${signOrderToken(order.id, input.email)}`,
    notifyUrl: `${origin}/api/payments/notify/mock`,
    customerEmail: input.email,
  });

  await supa
    .from('orders')
    .update({ payment_charge_id: handle.chargeId })
    .eq('id', order.id);

  return {
    ok: true as const,
    orderId: order.id,
    orderNumber: order.number,
    token: signOrderToken(order.id, input.email),
    redirectUrl: handle.redirectUrl ?? `/${input.locale}/order/${order.id}`,
  };
}
```

- [ ] **Step 1: Implement above + commit**

```bash
git commit -m "feat(server): placeOrder action — validate cart, reserve stock, mint order, hand to provider"
```

---

## Task 16: Payment notification endpoint + idempotency

**Files:** `src/app/api/payments/notify/[provider]/route.ts`

- [ ] **Step 1: Implement**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { MockProvider } from '@/domain/payment/adapters/MockProvider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerKey } = await params;
  if (providerKey !== 'mock') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }
  const provider = new MockProvider();

  let event;
  try {
    event = await provider.verifyNotification(request.clone());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bad signature' },
      { status: 400 },
    );
  }

  const supa = createServiceRoleSupabase();
  // Idempotency: skip if last_event_id matches
  const { data: order } = await supa
    .from('orders')
    .select('id, status, total_thb, last_event_id')
    .eq('id', event.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Unknown order' }, { status: 404 });
  if (order.last_event_id === event.eventId) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  if (order.total_thb !== event.amountThb) {
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  if (event.status === 'paid') {
    await supa
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        last_event_id: event.eventId,
        ship_status: 'preparing',
      })
      .eq('id', order.id);
    // Commit reserved stock
    const { data: items } = await supa
      .from('order_items')
      .select('variant_id, qty')
      .eq('order_id', order.id);
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
    await supa.from('order_events').insert({
      order_id: order.id, type: 'payment.paid',
      payload: { eventId: event.eventId, chargeId: event.chargeId }, actor: 'system',
    });
  } else if (event.status === 'failed' || event.status === 'expired') {
    await supa
      .from('orders')
      .update({ status: event.status === 'failed' ? 'failed' : 'cancelled', last_event_id: event.eventId })
      .eq('id', order.id);
    // Release reserved stock back to available
    const { data: items } = await supa
      .from('order_items')
      .select('variant_id, qty')
      .eq('order_id', order.id);
    for (const it of items ?? []) {
      if (!it.variant_id) continue;
      const { data: v } = await supa
        .from('variants')
        .select('stock_available, stock_reserved')
        .eq('id', it.variant_id)
        .maybeSingle();
      if (v) {
        await supa
          .from('variants')
          .update({
            stock_available: v.stock_available + it.qty,
            stock_reserved: Math.max(0, v.stock_reserved - it.qty),
          })
          .eq('id', it.variant_id);
      }
    }
    await supa.from('order_events').insert({
      order_id: order.id, type: 'payment.failed',
      payload: { eventId: event.eventId, chargeId: event.chargeId }, actor: 'system',
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(server): payment notification endpoint with idempotency + stock commit/release"
```

---

## Task 17: Mock simulator page (`/checkout/pay/[order]`)

**Files:** `src/app/[locale]/checkout/pay/[order]/page.tsx`. Two buttons: "Simulate success" and "Simulate failure". Each POSTs a signed event to `/api/payments/notify/mock`, then redirects to `/order/[id]?t=…`.

- [ ] **Step 1: Implement** as a client component that on click signs an event client-side (using a dev secret routed through a server action) and posts it. The signing must happen server-side to keep the dev secret out of the browser — so we expose a `simulatePayment(orderId, status)` server action.

```ts
// src/server/actions/mock-payment.ts
'use server';

import { headers } from 'next/headers';
import { signMockEvent } from '@/domain/payment/adapters/MockProvider';
import { createServiceRoleSupabase } from '@/db/server';

export async function simulateMockPayment(orderId: string, status: 'paid' | 'failed') {
  const supa = createServiceRoleSupabase();
  const { data: order } = await supa
    .from('orders')
    .select('id, total_thb, payment_charge_id, customer_email')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { error: 'Order not found' };
  const body = JSON.stringify({
    eventId: `mock_evt_${Date.now()}`,
    orderId: order.id,
    chargeId: order.payment_charge_id ?? 'mock_unknown',
    status,
    amountThb: order.total_thb,
  });
  const sig = signMockEvent(body);
  const h = await headers();
  const origin = h.get('origin') ?? 'http://localhost:3000';
  await fetch(`${origin}/api/payments/notify/mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mock-signature': sig },
    body,
  });
  return { ok: true as const, customerEmail: order.customer_email };
}
```

The simulator page calls this action, then redirects.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(checkout): mock-payment simulator page + simulateMockPayment action"
```

---

## Task 18: Order page + shipping timeline

**Files:**
- Create: `src/components/order/ShippingTimeline.tsx`, `src/app/[locale]/order/[id]/page.tsx`
- Server query: `src/server/queries/orders.ts::getOrderForGuest(id, token)`

`ShippingTimeline` renders the four nodes (Order placed / Payment received / Preparing / Shipped / Delivered) with timestamps. Tracking link uses a small carrier registry to deep-link.

- [ ] **Step 1: Query**

```ts
import 'server-only';
import { createServiceRoleSupabase } from '@/db/server';
import { verifyOrderToken } from '@/lib/order-token';

export async function getOrderForGuest(id: string, token: string) {
  const supa = createServiceRoleSupabase();
  const { data: order } = await supa.from('orders').select('*').eq('id', id).maybeSingle();
  if (!order) return null;
  if (!verifyOrderToken(token, id, order.customer_email)) return null;
  const { data: items } = await supa.from('order_items').select('*').eq('order_id', id);
  return { order, items: items ?? [] };
}
```

- [ ] **Step 2: `ShippingTimeline.tsx`** — 4-row vertical timeline with filled / hollow circles depending on order status.

- [ ] **Step 3: `/order/[id]/page.tsx`** — reads `?t=` token, calls the query, renders summary + timeline + line items + receipt link.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(order): guest order page with shipping timeline + signed-token lookup"
```

---

## Task 19: Receipt page (print-styled)

**Files:** `src/components/order/ReceiptDoc.tsx`, `src/app/[locale]/order/[id]/receipt/page.tsx`

`ReceiptDoc` is a server component that renders a clean A4-ish layout with `@media print` rules. The order page links to it with the same `?t=` token.

- [ ] **Step 1: `ReceiptDoc.tsx`** with print-friendly layout: brand, order number, date, lines, totals, shipping address, support email. Uses `@media print` to remove screen chrome.

- [ ] **Step 2: `receipt/page.tsx`** — same token check, renders `<ReceiptDoc>` + a `window.print()` button (client island).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(order): printable receipt at /order/[id]/receipt"
```

---

## Task 20: i18n + README + final gate

- [ ] **Step 1: Extend messages** (`messages/{th,en}.json`) with `cart`, `checkout`, `order`, `receipt` namespaces.
- [ ] **Step 2: README** — add a "Demo flow" section walking through cart → checkout → simulated payment → order page → receipt.
- [ ] **Step 3: Run** `bun run lint && bun run typecheck && bun run test && bun run build` → all green.
- [ ] **Step 4: Manual smoke walkthrough** (see below).

### Smoke walkthrough

1. `bun run dev` → http://localhost:3000 → /th.
2. Visit /admin → log in → create a product, set it Active.
3. Open /th/shop → click product → select size + color → "หยิบใส่ตะกร้า" (cart drawer slides in).
4. Click "Checkout" → fill name/email/address → Submit.
5. Land on mock simulator page → click "Simulate success".
6. Redirect to /th/order/[id]?t=… → shipping timeline shows "Payment received".
7. Click "Receipt" → print preview in browser.
8. Back in admin → /admin/products → variant stock decremented.

- [ ] **Step 5: Commit final checkpoint**

```bash
git commit -m "chore: Plan 3 final gate + README demo flow" || true
```

---

## Out of scope for Plan 3 (later)

| Concern | Plan |
|---|---|
| Admin orders list + fulfillment UI (mark shipped, tracking) | Plan 4 |
| Discount code admin (create/edit) | Plan 4 |
| Waitlist for sold-out variants | Plan 4 |
| Email notifications (Resend) | Plan 4 |
| Cron — release stale awaiting_payment | Plan 4 |
| Real PSP integration (FFP/Opn/Stripe) | Plan 6 |
| Google Sheets sync | Plan 5 |
| Tracking deep-links by carrier (full registry) | Plan 4 (when admin enters tracking) |
| Rate limiting on discount lookup + checkout | Plan 6 |
| Turnstile bot protection | Plan 6 |

---

## Self-review

- **Spec coverage:** orders/items/events/discounts/shipping zones schemas (§4), notification idempotency + amount re-check (§5 payment security), guest order lookup via signed link (D6), mock provider hard-disabled in prod (§5), receipt + timeline UX (§6.6/6.7).
- **Payment abstraction:** every real-money path goes through the `PaymentProvider` interface; swapping to FFP in Plan 6 is one new file under `adapters/`.
- **Cart cannot be tampered:** localStorage stores variant ids only; prices/totals are recomputed server-side at checkout.
- **No silent assumptions:** locked decisions explicit at top; alternatives noted in "Out of scope".
- **Commit per task; develop branch.**
