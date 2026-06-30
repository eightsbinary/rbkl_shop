# rb_shop

Single-creator ecommerce store for [rainbykello](https://www.twitch.tv/rainbykello).

**Status:** Plan 5 of 6 complete — Foundation + Catalog + Checkout + Operations + Sheets sync (dev-only two-way Google Sheets reconciliation) all green.
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
emails/      React Email templates (OrderPaid, OrderShipped, WaitlistRestock)
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
    email is sent (logged to console unless `RESEND_API_KEY` is set).
13. `/admin/discounts` → create a code; it applies at checkout.
14. On a sold-out variant's product page, the "notify me" form adds a waitlist
    entry visible under `/admin/waitlists`.

## Transactional email (Resend)

Order confirmation, shipping, and waitlist-restock emails go through a thin
`src/lib/email.ts` abstraction. Templates live in `emails/` as
[React Email](https://react.email) components.

- **No key set →** `sendEmail` logs a dry-run line to the console and returns
  `{ ok: true, dryRun: true }`. Local dev and the test suite never send real mail.
- **To send for real →** set `RESEND_API_KEY` (free tier: 3K emails/mo). Optionally
  override the sender with `RESEND_FROM` (defaults to Resend's shared
  `onboarding@resend.dev`).

```bash
RESEND_API_KEY=re_...                       # optional — omit for dry-run logging
RESEND_FROM="rainbykello <onboarding@resend.dev>"   # optional
NEXT_PUBLIC_SITE_URL=https://your-domain    # used for links in emails (defaults to localhost:3000)
```

## Background jobs (Vercel Cron)

Two hourly-ish jobs run as `GET` handlers under `src/app/api/cron/`, gated by a
shared bearer secret:

| Route | Schedule (`vercel.json`) | Does |
|---|---|---|
| `/api/cron/release-stale` | every 30 min | Cancels `awaiting_payment` orders older than 30 min and releases their reserved stock |
| `/api/cron/notify-waitlist` | hourly | Emails up to 20 oldest waiters per restocked variant, 4-hour gap between batches |

Set `CRON_SECRET` in the environment; Vercel injects it as
`Authorization: Bearer <CRON_SECRET>` on scheduled invocations. Requests without
the matching header get `401`. Trigger locally with:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/release-stale
```

## Google Sheets sync (dev-only)

A safe two-way sync between the DB and a Google Sheet for products, variants, and
orders. The DB is authoritative; the sheet is overwritten with a fresh snapshot
every run. Only allow-listed columns can be written back; everything else is
read-only and stale edits are rejected (logged in the run history).

Setup: create a Google Cloud service account, download its JSON key, share your
sheet with the service-account email as **Editor**, then set:

    GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}'
    GOOGLE_SHEETS_SPREADSHEET_ID=<id from the sheet URL>

Trigger from `/admin/sync` (dev role only) with "Sync now" (debounced 5 min).

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
