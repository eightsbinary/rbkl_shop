# rb_shop — Design Spec

**Project:** `rb_shop` — single-creator ecommerce store for the Thai streamer/creator **rainbykello**
**Author:** Design session, 2026-06-26
**Status:** Draft — awaiting user review
**Branch:** `develop`

---

## 1. Overview & goals

A clean, minimal, premium ecommerce site that lets one creator (rainbykello) sell merchandise to both Thai and international fans, while keeping operational overhead and recurring cost near zero.

**Hard constraints**

| Constraint | Value |
|---|---|
| Fixed/monthly cost | **$0** (variable per-transaction fees acceptable) |
| Hosting | Vercel free tier (Netlify is a fallback) |
| Cybersecurity | First-class concern at every layer |
| Operational toil | Minimal — auto-confirm flows preferred over manual creator action |
| Audience | Thai + international fans |
| Aesthetic | Clean, minimal, premium |

**Success criteria**

- Creator can add a product (with variants, images, stock, price) in under 5 minutes from the admin dashboard.
- A fan can complete a purchase in under 90 seconds on mobile.
- Payment is auto-confirmed; creator's only fulfillment action is "mark shipped + tracking number".
- No third-party recurring bill ever appears.
- No customer PII leaks; admin routes are unreachable without authenticated owner role; webhook endpoints reject unsigned/replayed events.

---

## 2. Stack (committed)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript strict** | Server Actions for CSRF-safe forms; middleware for auth gating; Vercel-native; mature ecosystem |
| UI | **Tailwind CSS + shadcn/ui primitives** | Composable, no runtime CSS-in-JS, accessible primitives, easy theming |
| Database | **Supabase Postgres (free tier)** | 500 MB DB; Row-Level Security at DB layer; one-product convenience for DB+Auth+Storage |
| Auth | **Supabase Auth (magic link)** — *to confirm in §8* | Passwordless = less to leak; same provider as DB so RLS sees `auth.uid()` natively |
| File storage | **Supabase Storage** | 1 GB free; integrates with RLS; we pre-resize images on upload (no paid transforms needed) |
| Payments | **Payment-provider abstraction** (PSP choice deferred) | FFP's developer docs sit behind merchant signup; we cannot verify webhook contract or sandbox availability from public sources. v1 ships with a **mock provider** for the demo. Real PSP is plugged in *after* rainbykello confirms FFP capability (or we switch to Opn / Stripe). Candidates: FFP, Opn Payments, Stripe. |
| Email | **Resend** | 3 K emails/month free; modern API; simple templates with React Email |
| Bot protection | **Cloudflare Turnstile** | Free, privacy-friendly CAPTCHA alternative; on checkout + signup + waitlist forms |
| Rate limiting | **Upstash Redis** | 10 K commands/day free; per-IP + per-account limits on sensitive endpoints |
| Validation | **Zod** | Same schemas reused on client + server (DTO + form + DB-write validation) |
| Forms | **react-hook-form + Zod resolver** | Best-in-class typed form layer |
| i18n | **next-intl** (route-based `/th`, `/en`) | Cleanest App Router i18n; SEO-friendly URLs |
| Testing | **Vitest + Playwright** | Unit/integration with Vitest; E2E for checkout + admin happy paths |
| Lint/format | **Biome** | One binary replaces ESLint + Prettier; faster + simpler config |
| Observability | **Vercel Analytics + Sentry (free tier)** | Free uptime + error tracking |

**Out of scope for v1** (call out so we don't drift): subscriptions, gift cards, blog/CMS, multi-creator, returns workflow, reviews/ratings, abandoned-cart emails, full-text product search (we'll use simple filters), inventory across multiple warehouses.

---

## 3. Architecture

### 3.1 High-level modules

```
apps/web/                     Next.js 15 app
  app/
    (storefront)/             Public routes — products, cart, checkout, waitlist
      [locale]/
        page.tsx              Landing
        shop/
        product/[slug]/
        cart/
        checkout/
        order/[id]/
    (account)/                Customer area (optional)
      [locale]/account/
    (admin)/                  Owner-only admin
      admin/
        products/
        orders/
        waitlists/
        discounts/
        settings/
    api/
      webhooks/feelfreepay/   FFP webhook (signature-verified)
      cron/                   Vercel cron jobs (stock release, abandoned holds)
  middleware.ts               Locale, admin gating, rate-limit headers

packages/
  db/                         Generated Supabase types + Drizzle schema (read-only mirror)
  domain/                     Pure domain logic (no I/O): pricing, stock, discount, shipping
    payment/                  PSP-agnostic Payment interface; adapters: mock, ffp (later), opn (later), stripe (later)
  ui/                         Shared UI primitives (shadcn-based)
  email/                      React Email templates
  config/                     Shared env, locale, currency, brand tokens

supabase/
  migrations/                 SQL migrations (versioned, reviewed)
  policies/                   RLS policies (per-table files)
  seed.sql                    Local dev seed
```

**Module boundaries**

- `domain/` is pure — no imports from `db`, `next`, or `supabase`. Easy to unit-test. Pricing, stock decrement logic, discount evaluation, shipping cost calc all live here as pure functions taking plain inputs.
- `db/` exposes typed query helpers only. No domain decisions.
- Server Actions in `app/` orchestrate: validate input (Zod) → call `domain/` → write through `db/` → return typed result.
- Admin and storefront share `ui/` but have separate route groups so admin code never ships to public bundles.

### 3.2 Data flow — purchase (provider-agnostic)

```
Fan → /checkout (Server Action: createOrder)
     ↳ Zod validate cart + shipping form
     ↳ domain.pricing.computeTotals (cart × current prices × discount × shipping)
     ↳ domain.stock.reserve (atomic UPDATE … SET reserved = reserved + qty)
     ↳ db.orders.insert(status='awaiting_payment')
     ↳ paymentProvider.createCharge({ orderId, amount, currency, method,
                                       returnUrl, notifyUrl })
       → returns { chargeId, redirectUrl?, qrPayload? }
     ↳ Redirect fan to redirectUrl OR render qrPayload inline

Provider → POST /api/payments/notify/{providerKey}    (server-to-server)
     ↳ Adapter verifies signature using provider-specific scheme
     ↳ Replay check (Upstash: SETNX event_id, 24 h TTL)
     ↳ Idempotency check (orders.last_event_id == event.id ? return 200)
     ↳ Transition: awaiting_payment → paid / failed
     ↳ If paid: stock.commit (reserved → sold), email confirmation via Resend
     ↳ If failed/expired: stock.release (reserved → available)

Cron (every 15 min) → release stale awaiting_payment orders > 30 min old
```

**Payment provider interface** (`domain/payment/PaymentProvider.ts`):

```ts
interface PaymentProvider {
  readonly key: string;                    // 'mock' | 'ffp' | 'opn' | 'stripe'
  createCharge(input: ChargeInput): Promise<ChargeHandle>;
  verifyNotification(req: Request): Promise<VerifiedEvent>;  // signature + replay
  reconcile(chargeId: string): Promise<ChargeStatus>;        // for redirect-return sanity check
}
```

Each adapter is a single file under `domain/payment/adapters/`. The app code never references a specific PSP — only the interface. Swapping PSPs = one env var + one new adapter file.

### 3.3 Data flow — admin product create

```
Owner → /admin/products/new
     ↳ Upload images (client-side resize to 3 sizes: 400, 800, 1600 webp)
       → POST to Supabase Storage signed URL
     ↳ Fill product form (name TH/EN, description TH/EN, variants matrix, prices, stock)
     ↳ Server Action: validate (Zod) → insert product + variants + image rows in one tx
     ↳ Trigger ISR revalidate on /shop and /product/[slug]
```

---

## 4. Data model

Postgres schema, simplified. All tables have `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. **Every table has RLS enabled.**

```sql
-- Identity & roles
profiles            (id=auth.users.id, role: 'customer'|'owner', display_name, locale)

-- Catalog
products            (slug uniq, status: 'draft'|'active'|'archived',
                     name jsonb {th, en}, description jsonb, base_price_thb,
                     category, weight_grams, hero_image_id)
product_images      (product_id fk, sort, url_400, url_800, url_1600, alt jsonb)
variant_options     (product_id fk, name: 'size'|'color'|..., values text[])
variants            (product_id fk, sku uniq, option_values jsonb,
                     price_thb (nullable override), stock_available int,
                     stock_reserved int, is_active)

-- Orders
orders              (number text uniq (random + check digit), customer_email,
                     customer_id fk nullable, status enum,
                     subtotal_thb, discount_thb, shipping_thb, total_thb,
                     currency, locale, shipping_address jsonb,
                     ffp_charge_id, ffp_payment_method, last_event_id,
                     paid_at, shipped_at, tracking_number, tracking_carrier,
                     notes_internal)
order_items         (order_id fk, variant_id fk, qty, unit_price_thb,
                     line_total_thb, product_snapshot jsonb)
order_events        (order_id fk, type, payload jsonb, actor)  -- audit log

-- Discounts
discount_codes      (code uniq, kind: 'percent'|'fixed', value, min_subtotal,
                     starts_at, ends_at, max_uses, uses, active)

-- Waitlist (pre-order interest for sold-out variants)
waitlist_entries    (variant_id fk, email, locale, notified_at)

-- Shipping
shipping_zones      (code, name, countries text[], rate_thb_first_kg,
                     rate_thb_additional_kg, max_weight_grams, is_active)

-- Settings (singleton row)
shop_settings       (brand jsonb, contact_email, ffp_keys (encrypted),
                     turnstile_keys, resend_key)
```

**Key invariants**

- `stock_available + stock_reserved` is the on-hand quantity.
- Reservation/commit transitions are wrapped in `BEGIN … COMMIT` with row-level locks (`SELECT … FOR UPDATE`) to prevent oversell.
- Order numbers are random base32 (10 chars + check digit) — non-enumerable so attackers can't scrape orders by ID.
- `last_event_id` makes webhooks idempotent at the row level (belt-and-suspenders with Upstash replay check).
- `product_snapshot` on `order_items` freezes price and metadata at purchase time, so historical orders remain correct even after products change.

### 4.1 RLS policy summary

| Table | customer (auth.uid()) | owner | anon |
|---|---|---|---|
| products (active) | SELECT | ALL | SELECT |
| products (draft/archived) | — | ALL | — |
| variants | SELECT (active products) | ALL | SELECT (active) |
| orders | SELECT WHERE customer_id = auth.uid() | ALL | — |
| order_items | SELECT via parent order | ALL | — |
| order_events | — | SELECT | — |
| profiles | SELECT/UPDATE self | ALL | — |
| discount_codes | SELECT (active+timewindow, code-lookup only via SECURITY DEFINER fn) | ALL | — |
| waitlist_entries | INSERT (own email) | ALL | INSERT |
| shop_settings | — | ALL | — |

Anonymous guest checkout writes go through a **security-definer function** that creates the order and order_items atomically — anon role never has direct INSERT on `orders`.

---

## 5. Security model

Cybersecurity is a primary goal, so this section is intentionally detailed.

**Authentication**
- Supabase Auth, magic-link only (no passwords to leak). Owner role granted by manually flipping `profiles.role = 'owner'` on the creator's row.
- Sessions in httpOnly + Secure + SameSite=Lax cookies. Cookie name not branded `supabase-*` (rename via SSR config to reduce fingerprinting).
- Admin routes gated in `middleware.ts` *and* re-checked in every server action (defense in depth).

**Authorization**
- RLS enforces row-level access at the database. App-layer checks are advisory; DB is the truth.
- Owner-only mutations always re-check role server-side, never trust client.

**Input validation**
- Every Server Action and API route starts with `schema.parse(input)` using Zod. Failed parses return generic error (no field-name leaks).
- File uploads: MIME sniff + size cap (2 MB) + image-only allowlist + re-encode through `sharp` to strip EXIF and any malicious payloads.

**Payment security** (provider-agnostic rules every adapter must follow)
- Notification handler: verify signature with `crypto.timingSafeEqual`. Reject unsigned, expired (> 5 min skew), or replayed (Upstash SET NX with 24 h TTL).
- Never trust amount from notification payload — re-derive expected amount from `orders.total_thb` and compare.
- For redirect-return flows, never trust query params alone — always call `provider.reconcile(chargeId)` server-side to confirm status.
- All PSP secrets in Vercel env vars; never in repo, never in client bundles.
- The mock provider used in the demo phase only accepts notifications from `localhost` and signed with a randomly-generated dev key — it never touches real money and is hard-disabled in production builds via build-time env check.

**Rate limiting (Upstash)**
- `/checkout`: 10/min per IP, 30/hour per email.
- `/api/webhooks/*`: not rate-limited (FFP retries), but signature-gated.
- `/admin/login`: 5/min per IP (magic-link request).
- Waitlist signup: 3/min per IP.

**Bot protection**
- Turnstile on checkout, signup, waitlist, contact.
- Honeypot field in all public forms as cheap second layer.

**Headers (via Next.js config + middleware)**
- `Content-Security-Policy` strict with nonces (no `'unsafe-inline'`).
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` locked down.
- `X-Frame-Options: DENY` for admin routes (clickjacking).

**Secrets & supply chain**
- `.env.example` checked in with empty values; `.env.local` git-ignored.
- Dependabot/Renovate on weekly schedule.
- Lockfile committed; `npm ci` in CI.
- No analytics SDKs that touch PII without explicit consent banner.

**Audit logging**
- Every order state transition writes to `order_events` with actor + payload — gives the creator and us a forensic trail if anything looks wrong.

**PII minimization**
- Don't store customer's full address after the order is shipped + 90 days, unless a customer account exists. Replace with hashed reference for analytics.
- Webhook payloads scrubbed before any logging.

---

## 5a. Admin model — how rainbykello manages the shop

### How she becomes the admin (one-time bootstrap)

There is no public "make me admin" endpoint. The owner role is granted **only via direct database access**, which means only the person who deploys the project (her, or someone she trusts) can do it.

Concretely:

1. On first deploy, she signs in once via magic link → a `profiles` row is auto-created with `role='customer'`.
2. We run a one-time script `npm run grant-owner -- her@email.com` (or a single SQL line in the Supabase dashboard) that flips `role='owner'`.
3. From that moment, all admin routes and admin RLS policies allow her account.

This pattern means: **no exposed surface area for someone to claim ownership**. The script lives in the repo but does nothing without DB credentials only she controls.

### UX rule: no developer jargon in the admin UI

The admin UI is built for one non-technical user. Anywhere a technical term would naturally appear, we use plain English/Thai instead:

| Internal term | What rainbykello sees |
|---|---|
| webhook / IPN | (nothing — invisible to her) |
| `awaiting_payment` | "Waiting for payment" / "รอชำระเงิน" |
| `paid` | "Payment received" / "ได้รับเงินแล้ว" |
| `failed` | "Payment did not go through" / "ชำระเงินไม่สำเร็จ" |
| signature verification | (nothing — invisible) |
| RLS / policy | (nothing — invisible) |
| charge_id | "Order reference" / "หมายเลขอ้างอิง" |
| reconciliation | "Confirm with bank" / "ตรวจสอบกับธนาคาร" |

If a developer-level error needs to surface (e.g., FFP API down), she sees: "Something on the payment provider's side is wrong — we've logged it and your customer hasn't been charged. Try again in a few minutes."

### How she logs in daily

1. Visit `/admin` (or `rainbykello.shop/admin`).
2. Enter email → receive magic link → click link → in.
3. Session stored in httpOnly + Secure cookie. Idle timeout 7 days; absolute max 30 days; signing out anywhere invalidates everywhere.
4. No password to forget, no password to phish, no password to reuse.

### What she can do once in

| Area | Capabilities |
|---|---|
| Products | Create, edit, archive; manage variants (size/color); upload images (auto-resized); bilingual TH/EN content; set price, weight, category, stock |
| Stock | Adjust on-hand counts; see reserved vs available split; receive low-stock email at configurable threshold |
| Orders | View all orders by status; see line items + shipping address; mark shipped with tracking carrier + number; add internal notes; see full event log |
| Discount codes | Create %/fixed-amount codes; set validity window, min subtotal, max uses; toggle active |
| Waitlist | View who's waiting on each variant; trigger restock notifications |
| Shipping | Edit zones (countries + rates), add new zones |
| Settings | Edit brand info, contact email, FFP keys (write-only — never displayed back), email templates |
| Audit log | Read-only view of every order state transition with timestamp + actor |

### Hardening for the owner account specifically

Magic link is already pretty good (something-you-have = inbox access). For the *owner* account, we propose extra layers:

- **TOTP second factor** on admin login (Supabase Auth supports it). Recovery codes printed once at setup.
- **New-device email alert** — if an admin session is created from a previously-unseen device fingerprint, she gets an email immediately.
- **Optional IP allowlist** — env var with her IPs; if set, admin routes 403 from anything else. Great for fixed home/studio, friction if she travels — opt-in.
- **Session-level "step-up" auth** for destructive actions (e.g., delete product, edit FFP keys) — re-prompt for magic link in last 5 min.

(D11/D12 in §8 ask which of these she wants on at launch.)

### What if she needs help (e.g., a manager or fulfillment partner)?

Two patterns possible; we'd default to (a) for v1:

- **(a) Single owner, single account** — simplest, fewest moving parts.
- **(b) Multiple owners, role-scoped permissions** — add `role='staff'` with limited rights (e.g., orders-only). More tables and UI; only worth it if she'll have a real team. (D12.)

---

## 6. Core flows

### 6.1 Checkout (guest, QR-style method e.g. PromptPay)

1. Fan picks variants, lands on `/checkout` with cart in `localStorage`.
2. Fill name, email, shipping address; choose shipping zone (auto-detected by country).
3. Turnstile challenge runs invisibly.
4. Submit → Server Action validates → creates `orders` row with `awaiting_payment` + reserves stock.
5. Server calls `paymentProvider.createCharge({ method: 'promptpay', ... })` → returns `qrPayload`.
6. Fan scans QR in their bank app → pays.
7. Provider sends notification → adapter verifies signature, we transition to `paid`, commit stock, email receipt.
8. Fan's polling page (`/order/[id]`) detects status change and shows success.

### 6.2 Checkout (international, card / redirect method)

1. Same up to step 4.
2. Server calls `paymentProvider.createCharge({ method: 'card', ... })` → returns hosted page `redirectUrl`.
3. Fan completes 3-D Secure on PSP-hosted page.
4. PSP redirects fan back to `/order/[id]?charge=…`.
5. We verify final status via `paymentProvider.reconcile(chargeId)` server-side (don't trust the redirect alone) **and** via the async notification (race-safe — whichever wins, the order ends in the same state).

### 6.3 Demo phase (no real money)

While we wait on PSP verification, the demo site uses the **mock provider**:

- Checkout works end-to-end, but instead of a real QR or hosted page, fan sees a dev-only screen with two buttons: "Simulate successful payment" / "Simulate failed payment".
- The mock provider sends itself a signed notification, and the rest of the flow (stock commit, emails, admin order list) runs exactly as it will in production.
- This lets rainbykello fully review the storefront + admin + order lifecycle before we touch real money.
- The mock provider is **hard-disabled in production builds** via a build-time env check — there's no way to ship it accidentally.

### 6.4 Admin: add product

1. Owner navigates `/admin/products/new`.
2. Upload up to 6 images — client resizes to 400/800/1600 webp before upload, strips EXIF.
3. Fill bilingual name + description, base price, weight, category.
4. Define variant axes (e.g., Size: S/M/L/XL × Color: black/cream). UI builds the matrix.
5. Per-variant stock + optional price override.
6. Status: draft / active. Saving as draft hides from storefront.
7. Submit → server action → product + variants + images created atomically → `revalidatePath('/shop')`.

### 6.5 Admin: order fulfillment

1. `/admin/orders` shows paid orders grouped by status.
2. Click order → see line items, shipping address (with copy-to-clipboard for label).
3. Mark shipped: enter tracking carrier + number → save → fan receives "shipped" email.
4. Optional notes field for internal annotations.

### 6.6 Waitlist (sold-out variant)

1. Fan sees "Sold out — notify me" instead of "Add to cart".
2. Email + Turnstile → row in `waitlist_entries`.
3. When owner sets `stock_available > 0` on a variant with waiters, a background job (Vercel cron, hourly) emails the first N waiters with a 24-hour priority link.

### 6.7 Discount codes

1. Owner creates in `/admin/discounts` — code, kind (%/fixed), value, min subtotal, valid window, max uses.
2. Fan enters code at checkout → security-definer DB function evaluates and returns adjusted total (rate-limited per IP to prevent enumeration).

---

## 7. Aesthetic direction

You said you'll pick when reviewing this doc. All three share the same minimal/premium intent — they differ in mood. Each gets the same 3-column product grid you specified.

### Option A — Soft Studio (warm, intimate, boutique)
- **Background:** warm off-white `#FAF7F2`
- **Type:** Fraunces (display serif) + Inter (body)
- **Accent:** dusty rose `#C9A0A0`
- **Photography:** oversized lifestyle shots, soft natural light
- **Feel:** like a small, curated personal-brand boutique — warm, slow, intentional
- **Best for:** if rainbykello's personal brand reads as soft, feminine, lifestyle-leaning

### Option B — Editorial Mono (confident, fashion-forward)
- **Background:** bone white `#F8F8F6`
- **Type:** Inter Tight (all-caps for headers) + Inter (body)
- **Accent:** single vivid color (hot pink `#FF2D88` or electric blue `#2D5BFF`)
- **Photography:** flat-lay product shots on neutral backdrop, brutalist grid
- **Feel:** like Aimé Leon Dore / Acne Studios — coolly premium, drop-driven
- **Best for:** if rainbykello's brand reads as confident, fashion/streetwear-adjacent

### Option C — Y2K Soft (playful, fan-forward, emotional)
- **Background:** pastel `#F6F1FA` (lilac) or `#EAF5F0` (mint)
- **Type:** Recoleta (soft display) + Inter (body)
- **Accent:** lilac `#B79CE0` and mint `#B8E4D0`
- **Photography:** product + tactile props (stickers, fabric), candy shadows
- **Feel:** like contemporary K-pop / Asian beauty merch — cute, emotional, fan-coded
- **Best for:** if rainbykello's brand is cute/dreamy/community-coded

All three use:
- 3-column product grid (per your specification)
- 8-pt spacing rhythm
- Generous whitespace, no decorative chrome
- Subtle 200 ms hover transitions, no animation-for-its-own-sake
- WCAG AA contrast everywhere

---

## 8. Open decisions — TO CONFIRM before implementation

These are the choices I won't make silently. Each has my recommendation; please confirm or pick another.

| # | Decision | Options | My recommendation |
|---|---|---|---|
| D1 | Aesthetic direction | A / B / C from §7 | *Need user pick* |
| D2 | Variant axes | (a) Size only, (b) Size + Color, (c) Fully flexible up to 3 axes | **(b) Size + Color** — covers 95% of merch; (c) adds UI complexity for rare cases |
| D3 | Shipping cost model | (a) Flat per zone (TH / SEA / Worldwide), (b) Weight-tiered per zone, (c) Free over threshold + flat | **(a) Flat per zone** — simplest, easy to tune in admin; weight-tiered if products vary wildly in weight |
| D4 | Customer accounts | (a) Magic link only, (b) Email + password, (c) Add Google/Twitch SSO later | **(a) Magic link** — nothing to leak; lower friction than passwords |
| D5 | Cart persistence | (a) localStorage only, (b) localStorage + DB-backed on login | **(a) localStorage** for v1 — simpler, no extra schema; upgrade later if needed |
| D6 | Order lookup for guests | (a) Email + order number, (b) Magic link to order page | **(b) Magic link** — better security than guessable email+number combo |
| D7 | Currencies displayed | (a) THB only (auto FX shown), (b) Multi-currency display, charge THB | **(a) THB only** — FFP settles THB; multi-currency UX is hard to get right |
| D8 | Domain & email-from | TBD by user — do you have `rainbykello.shop`, etc.? | Need user input |
| D9 | Sentry / error tracking | (a) Sentry free tier (5K events/mo), (b) Skip, rely on Vercel logs | **(a) Sentry** — invaluable on first launch |
| D10 | Legal pages | (a) Use templates (privacy, terms, returns, shipping) — user reviews, (b) User provides | **(a)** with strong recommendation user has a Thai lawyer review before launch |
| D11 | Owner-account hardening level | (a) Magic link only, (b) Magic link + TOTP, (c) Magic link + TOTP + IP allowlist, (d) Magic link + TOTP + step-up auth on destructive actions | **(d)** — strongest practical default; IP allowlist is opt-in later |
| D12 | Team-member access (staff role) | (a) Single owner only (v1), (b) Add `role='staff'` with order-only permissions | **(a)** for v1 — YAGNI unless she actually has staff |
| D13 | Real PSP choice | Deferred — confirmed via demo + rainbykello after she shows us FFP's actual capability, or we switch | Build with mock provider; decide after demo review |

---

## 9. Cost analysis ($0 fixed cost)

| Service | Free tier limit | Expected usage v1 | Pad |
|---|---|---|---|
| Vercel | 100 GB bw, 100 GB-h functions | 5–10 GB bw | 10× |
| Supabase | 500 MB DB, 1 GB storage, 50 K MAU | <50 MB DB, 200–400 MB storage | 10× |
| Resend | 3 K emails/mo | 300–600 | 5× |
| Upstash | 10 K commands/day | 1–2 K | 5× |
| Turnstile | Unlimited | — | — |
| Sentry | 5 K events/mo | <500 | 10× |
| FeelFreePay | No monthly fee | ~1% PromptPay, ~3.65% card | per-tx only |

**Conclusion:** $0 monthly, scales to ~3–5× current expected traffic before any tier needs an upgrade.

---

## 10. Rollout plan (sketch — full plan comes in next step)

### Phase 1 — Demo site (no real money)

1. Repo scaffold + CI on `develop` (Biome, Vitest, Playwright in CI)
2. Supabase project + migrations + RLS policies + seed
3. Core domain logic + tests (pricing, stock, discount, shipping)
4. Payment provider interface + **mock adapter** (success/fail simulator)
5. Storefront read-only (product list, product detail) with i18n
6. Cart + checkout wired to mock provider end-to-end
7. Admin: products, orders, discounts, waitlists, settings (no payment-config UI yet)
8. Email templates (Resend) + cron jobs
9. Security pass: CSP, rate limits, Turnstile, audit log
10. E2E tests (Playwright) — checkout happy + sad paths, admin product create
11. Deploy to a private Vercel preview URL

### 🚦 Gate: rainbykello reviews the demo

Per user direction: she walks through the demo herself, confirms the storefront / admin / order lifecycle are right, and only then do we touch real payments. No PSP integration before this gate.

### Phase 2 — Real PSP integration (after demo approval)

12. Rainbykello shares FFP merchant docs + sandbox keys (or we pivot to Opn / Stripe based on what's actually available).
13. Implement chosen PSP adapter against the existing interface.
14. Adapter-level tests (signature verify, replay, reconcile).
15. End-to-end test on PSP sandbox.
16. Pre-launch checklist: legal pages, SEO, OG images, error pages, monitoring.
17. Production cutover.

Detailed task-level plan for Phase 1 will be produced by `writing-plans` once this design is approved.
