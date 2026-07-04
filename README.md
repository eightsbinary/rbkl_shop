# rbkl_shop

Single-creator ecommerce store for [rainbykello](https://www.twitch.tv/rainbykello).

**Status:** Roadmap complete — Foundation · Catalog · Checkout · Operations · Sheets sync (two-way Google Sheets reconciliation with preview-before-apply) · Security hardening (×2) · Editorial Mono redesign (home, PDP, about, cart) · Admin TH/EN i18n · Manual PromptPay payments (QR + slip verify) · Pre-orders. All green.

**2026-07-04 operations batch (live):**
- **Admin search everywhere** — Orders (number/email), Products (name TH/EN or slug), Newsletter (email), Waitlists (product), Discounts (code), plus a global search on the dashboard (`/admin/search`) that fans one query across all sections.
- **Buyer order self-service** — "Track order" in the header + footer; `/track` looks up by order number + email, or emails the buyer links to all their orders if they lost the number ("Don't know your order number?").
- **Pre-order lifecycle completed** — orders paid with pre-order items sit in *awaiting stock*; a new admin "Stock arrived — start preparing" button moves them to *preparing* and emails the buyer; the order page shows each pre-order item's expected ship date; full pre-orders offer the waitlist; the waitlist cron also notifies when pre-order slots open (not just restocks).
- **Email live via Gmail SMTP** (App Password), confirmed end-to-end in production; Resend remains as an alternative provider.
- **Distributed rate limiting** live via Upstash Redis.
- **Sheets sync enabled in production** with a preview-before-apply safeguard (see below).
- **Brand accents** — gold Latin cross favicon, email-header dagger mark, ombre wordmark in the admin nav.
- **Deploys** — Vercel↔GitHub connected: push to `main` auto-deploys production; `develop` previews disabled (Preview env has no Supabase vars).
**Spec:** [docs/superpowers/specs/2026-06-26-rb-shop-design.md](docs/superpowers/specs/2026-06-26-rb-shop-design.md)
**Plans:** [docs/superpowers/plans/](docs/superpowers/plans/)

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Supabase (Postgres + Auth + Storage + RLS) · Resend + React Email · Vercel Cron · Bun · Biome · Vitest · Zod.

## Prerequisites

- [Bun](https://bun.sh) `>= 1.1.0`
- [Supabase CLI](https://supabase.com/docs/guides/local-development) for local DB work
- [Docker Desktop](https://www.docker.com/products/docker-desktop) with **WSL 2 integration enabled for your Ubuntu distro** if you develop on Windows. Supabase local runs in Docker.

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Start local Supabase (requires Docker running)
supabase start
# Copy the printed URL, anon key, and service role key into .env.local
# (template: .env.example).

# 3. Generate DB types from the live local stack
bun run db:types

# 4. Dev server
bun run dev
```

If you don't have Docker / Supabase CLI yet, the app still **builds and tests cleanly** against the hand-crafted `src/db/types.gen.ts` stub. You only need the live stack when actually exercising Supabase calls.

## Common commands

| Command | What it does |
|---|---|
| `bun run dev` | Local Next.js dev server (http://localhost:3000) |
| `bun run build` | Production build |
| `bun run lint` | Biome lint + format check |
| `bun run lint:fix` | Biome auto-fix |
| `bun run typecheck` | TypeScript no-emit check |
| `bun run test` | Vitest unit tests |
| `bun run test:watch` | Vitest watch mode |
| `bun run db:types` | Regenerate `src/db/types.gen.ts` from local Supabase |
| `bun run db:reset` | Apply migrations from scratch + seed |
| `bun run grant:owner -- <email>` | Promote a user to owner (their auth user must exist first — see [Granting a production admin](#granting-a-production-admin)) |
| `bun run grant:dev -- <email>` | Promote a user to dev — bootstrap your own access first |

## Layout

```
src/
  app/       Next.js routes (incl. /admin, /api/cron/*, /api/waitlist)
  domain/    Pure logic (no I/O) — Money, pricing, stock, discount, shipping, carriers, stale-orders
  db/        Supabase client factories + role-check helpers + generated types
  lib/       Cross-cutting: env validation, brand tokens, email, order-token
  server/    Server actions + queries (admin orders/waitlists, discounts, ship-order)
emails/      React Email templates (OrderPaid, OrderShipped, SlipReceived/Rejected, PreorderPreparing, WaitlistRestock, OrderLinks, SignIn)
tests/unit/  Vitest unit tests mirroring src/
supabase/    Migrations + RLS policies + seed
scripts/     One-shot CLI scripts (run locally with `bun run scripts/*.ts`)
```

## Bootstrapping your dev account (first time)

1. `supabase start` and `bun run dev`
2. Use Supabase Studio (URL printed by `supabase start`) → Authentication → Add User → enter your email.
3. `bun run grant:dev -- your@email.com`
4. You're now a dev. Sign in at `/admin/login` (magic link → [Mailpit](http://127.0.0.1:54324)).

## Granting a production admin

`/admin` is gated by the `owner`/`dev` role on `profiles`, and the login page has
self-signup disabled (`shouldCreateUser: false`). So a production admin is
provisioned in two steps — **create the auth user, then grant the role** — against
the **production** Supabase project. You do *not* run this on Vercel: Vercel only
hosts the app, there's no shell there for one-off scripts.

**Recommended — Supabase dashboard (no local secrets, no wrong-DB risk):**

1. Supabase dashboard → production project → **Authentication → Users → Add user** →
   enter the email. The `on_auth_user_created` trigger auto-creates their `profiles`
   row as `customer`.
2. **SQL Editor** → promote them:
   ```sql
   update public.profiles set role = 'owner'  -- or 'dev'
   where id = (select id from auth.users where email = 'her@email.com');
   ```
3. They sign in via the magic link at `/admin/login` → dashboard access.

**Alternative — run the grant script locally, pointed at production:**

```bash
vercel env pull .env.production.local   # pulls prod NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
bun --env-file=.env.production.local scripts/grant-owner.ts her@email.com
```

- The account must already exist in prod auth (step 1), or the script exits with
  `No user found`.
- `--env-file` forces the prod creds. Otherwise `.env.local` (your **local**
  Supabase) can win and you'd grant on the wrong database — verify the printed
  user id is the production one.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. `.env.production.local` is gitignored
  (`.env*`); delete it when done if you prefer.

## Roles

| Role | Can do |
|---|---|
| `customer` | (default) Browse, buy, see own orders |
| `owner` | Manage products, orders, discounts, shipping, settings |
| `dev` | Everything `owner` does + role management, audit, diagnostics |

Only a `dev` can grant or revoke roles. The first `dev` is bootstrapped via `scripts/grant-dev.ts` (DB credentials required) — there is no in-app way to claim it.

## Demo flow (end-to-end with the mock payment provider)

1. `bun run dev` and open http://localhost:3000 (redirects to `/th`).
2. Visit `/admin` → log in (magic link arrives in [Mailpit](http://127.0.0.1:54324)).
3. Create a product → set Active + Featured → upload an image → Save.
4. Visit `/th/shop` → pick a product → choose size/color → "หยิบใส่ตะกร้า".
5. Cart drawer slides in → click "ชำระเงิน".
6. Fill name / email / address → Submit.
7. Mock simulator page → click "Simulate successful payment".
8. Land on `/th/order/[id]?t=…` → shipping timeline shows "Payment received".
9. Click "ใบเสร็จ" → printable receipt → browser print to PDF.
10. Back in `/admin/products` → variant stock is decremented.
11. `/admin/orders` → the order shows status **paid** / shipping **preparing**. Open it.
12. Fill the ship form (carrier + tracking number) → "Mark as shipped". The buyer's
    `/order/[id]` page now shows **Shipped** with a tracking link, and a shipping
    email is sent (logged to console unless Gmail/Resend credentials are set).
13. `/admin/discounts` → create a code; it applies at checkout.
14. On a sold-out variant's product page, the "notify me" form adds a waitlist
    entry visible under `/admin/waitlists`.

## Transactional email (Gmail SMTP, with Resend as alternative)

Order confirmation, slip received/rejected, pre-order preparing, shipping,
waitlist, and order-recovery emails go through a thin `src/lib/email.ts`
abstraction. Templates live in `emails/` as
[React Email](https://react.email) components.

The provider is chosen by the admin Settings toggle (`app_settings.email_provider`),
falling back to the `EMAIL_PROVIDER` env var, defaulting to **Gmail**.

- **Gmail (production today):** set `GMAIL_USER` + `GMAIL_APP_PASSWORD`
  (a Google [App Password](https://myaccount.google.com/apppasswords), not the
  account password). Gmail forces the sender to the authenticated account;
  `MAIL_FROM` only controls the display name.
- **Resend (once a domain is registered):** set `RESEND_API_KEY`
  (free tier: 3K emails/mo) and optionally `RESEND_FROM`.
- **Neither configured →** `sendEmail` logs a dry-run line and returns
  `{ ok: true, dryRun: true }`. Local dev and the test suite never send real mail.

```bash
GMAIL_USER=you@gmail.com                    # production sender account
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx      # App Password (2FA required)
NEXT_PUBLIC_SITE_URL=https://your-domain    # used for links in emails (defaults to localhost:3000)
```

> **⚠️ Env values on Vercel:** Next.js strips wrapping quotes from `.env.local`;
> Vercel keeps them verbatim. When copying a quoted value (especially JSON) into
> a Vercel env var, strip the quotes first or the value won't parse in production.

## Background jobs (GitHub Actions cron + Vercel daily fallback)

Two jobs run as `GET` handlers under `src/app/api/cron/`, gated by a shared
bearer secret. Vercel's Hobby plan only allows **daily** crons, so the real
cadence is driven by GitHub Actions (`.github/workflows/cron.yml`, needs repo
variable `SITE_URL` + secret `CRON_SECRET`) and `vercel.json` keeps a daily
fallback:

| Route | Real cadence (GH Actions) | Does |
|---|---|---|
| `/api/cron/release-stale` | every 30 min | Cancels `awaiting_payment` orders older than 30 min and releases their reserved stock |
| `/api/cron/notify-waitlist` | hourly | Emails up to 20 oldest waiters per variant that's available again (restock **or** open pre-order slots), 4-hour gap between batches |

The 30-min `release-stale` query also doubles as a **Supabase free-tier
keep-alive** — the project can never hit the 7-idle-day auto-pause.

Set `CRON_SECRET` in both Vercel and the GitHub repo secrets. Requests without
the matching `Authorization: Bearer` header get `401`. Trigger locally with:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/release-stale
```

## Google Sheets sync (preview-before-apply)

A safe two-way sync between the DB and a Google Sheet for products, variants, and
orders. The DB is authoritative; the sheet is overwritten with a fresh snapshot
every run. Only allow-listed columns can be written back; everything else is
read-only and stale edits are rejected (logged in the run history).

Setup: create a Google Cloud service account, download its JSON key, share your
sheet with the service-account email as **Editor**, then set:

    GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}'
    GOOGLE_SHEETS_SPREADSHEET_ID=<id from the sheet URL>

(The code tolerates the wrapping quotes either way — see the env warning above.)

Run it from `/admin/sync` (owner or dev) in two steps:

1. **Preview changes** — a dry run that lists every cell that would change
   (`old → new`) plus edits that would be rejected. Nothing is written.
2. **Apply** — the real run (debounced 5 min). With no pending changes the same
   button reads "Sync & refresh sheet" and just refreshes the sheet snapshot.

> **First run:** hit Preview, then "Sync & refresh sheet" once — that fills the
> sheet tabs with the current catalog. After that the owner workflow is:
> edit the sheet → Preview → check the list → Apply.

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
double-process race in the previous read-then-check. It is also idempotent at the
order level: the paid/failed transition is only applied from `awaiting_payment`,
so a second *distinct* event for an already-terminal order returns
`{ ok: true, skipped: true }` without re-decrementing stock or re-sending email.

### Admin CSP

`/admin` responses use a per-request nonce (`src/proxy.ts`) so `script-src`
drops `'unsafe-inline'`. The storefront keeps the pragmatic CSP to stay
statically cacheable. `style-src 'unsafe-inline'` remains (React inline style
attributes can't be nonced).

## Build runtime split

`bun run build` runs `node ./node_modules/next/dist/bin/next build` because Bun's
runtime hits a hooks-dispatcher null on Next.js 16's `/_global-error`
prerender. Bun handles install / dev / scripts / tests / lint / typecheck;
Node handles only `next build` (which matches Vercel's production runtime).

## Branch

Active development happens on **`develop`**. Every meaningful step gets its own commit. `main` only sees merges after a Plan completes.
