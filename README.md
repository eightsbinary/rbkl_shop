# rb_shop

Single-creator ecommerce store for [rainbykello](https://www.twitch.tv/rainbykello).

**Status:** Plan 3 of 6 complete — Foundation + Catalog + Checkout (mock payment) all green.
**Spec:** [docs/superpowers/specs/2026-06-26-rb-shop-design.md](docs/superpowers/specs/2026-06-26-rb-shop-design.md)
**Plans:** [docs/superpowers/plans/](docs/superpowers/plans/)

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Supabase (Postgres + Auth + Storage + RLS) · Bun · Biome · Vitest · Zod.

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
| `bun run grant:owner -- <email>` | Promote a user to owner (run after they sign in once) |
| `bun run grant:dev -- <email>` | Promote a user to dev — bootstrap your own access first |

## Layout

```
src/
  app/       Next.js routes
  domain/    Pure logic (no I/O) — Money, pricing, stock, discount, shipping
  db/        Supabase client factories + role-check helpers + generated types
  lib/       Cross-cutting: env validation, brand tokens
tests/unit/  Vitest unit tests mirroring src/
supabase/    Migrations + RLS policies + seed
scripts/     One-shot CLI scripts (run locally with `bun run scripts/*.ts`)
```

## Bootstrapping your dev account (first time)

1. `supabase start` and `bun run dev`
2. Use Supabase Studio (URL printed by `supabase start`) → Authentication → Add User → enter your email.
3. `bun run grant:dev -- your@email.com`
4. You're now a dev. Magic-link sign-in surface is added in a later plan.

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

## Build runtime split

`bun run build` runs `node ./node_modules/next/dist/bin/next build` because Bun's
runtime hits a hooks-dispatcher null on Next.js 16's `/_global-error`
prerender. Bun handles install / dev / scripts / tests / lint / typecheck;
Node handles only `next build` (which matches Vercel's production runtime).

## Branch

Active development happens on **`develop`**. Every meaningful step gets its own commit. `main` only sees merges after a Plan completes.
