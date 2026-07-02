# Newsletter subscriber capture — design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)

## Goal

Capture the emails of fans / prospective buyers from the public site so the shop
owner can send product updates and news **later**. This slice covers **capture +
admin retrieval only**. It does not send anything yet.

The homepage already has a `NewsletterBand` UI stub (dark "Journal" band) that
fakes success and discards the email. This feature makes it real and gives the
admin a way to see and export the collected list.

## Non-goals (deliberately deferred)

- Sending newsletters / broadcasts (no compose UI, no Resend Audiences wiring).
- Unsubscribe flow (the schema reserves room for it, but no route is built).
- Double opt-in / confirmation email — signups are **single opt-in**.
- Turnstile on the signup form (rate-limit only for now; addable later).

These are out of scope; the schema is shaped so they can be added without a
migration rewrite.

## Precedent

This mirrors the existing **waitlist** feature almost exactly:

- Capture: public `POST /api/waitlist` — zod validate, rate-limit by IP, insert,
  treat unique-violation `23505` as success. (`src/app/api/waitlist/route.ts`)
- Table: `waitlist_entries` with anon-insert RLS + owner/dev manage + `sb_`-key
  grants. (`supabase/migrations/20260627002000_waitlists.sql`)
- Admin: `/admin/waitlists` page → `listWaitlistGroups()` server query →
  `WaitlistsTable` i18n client component.

The newsletter reuses these patterns and utilities (`enforceRateLimit`,
`clientIp`, `createServerSupabase`, `requireOwnerOrDev`).

## Data model

New migration: `newsletter_subscribers`.

| column           | type          | notes                                             |
|------------------|---------------|---------------------------------------------------|
| `id`             | uuid pk       | `default gen_random_uuid()`                       |
| `email`          | text not null | stored lowercased; **`unique`**                   |
| `locale`         | text not null | `check (locale in ('th','en'))`                   |
| `source`         | text          | nullable; e.g. `'home_band'` (future segmentation)|
| `status`         | text not null | `default 'active' check (status in ('active','unsubscribed'))` |
| `created_at`     | timestamptz   | `default now()`                                   |
| `unsubscribed_at`| timestamptz   | null until an unsubscribe flow exists             |

Index: `newsletter_subscribers(created_at desc)` for the admin list.

`status` + `unsubscribed_at` exist only to future-proof sending/unsubscribe. No
code writes anything but `'active'` in this slice.

### RLS + grants (mirror `waitlists.sql`)

- `newsletter_anon_insert`: `insert` to `anon, authenticated` `with check (true)`.
- `newsletter_owner_dev_all`: `all` to `authenticated`
  `using (public.is_owner_or_dev()) with check (public.is_owner_or_dev())`.
- Grants: `insert` to `anon, authenticated`; `select, insert, update, delete` to
  `authenticated, service_role` (mandatory for the new-style `sb_` keys).
- Add `supabase/policies/newsletter.sql` to match the existing policy-file
  convention.

## Public capture — `POST /api/newsletter`

Mirrors `/api/waitlist`:

1. Parse JSON; zod body `{ email: z.string().email(), locale: z.enum(['th','en']),
   source: z.string().max(50).optional() }`. Invalid → `400`.
2. `ip = await clientIp()`; `enforceRateLimit('newsletter', ip, { max: 5,
   windowMs: 60_000 })`. Not ok → `429`.
3. Insert `{ email: email.toLowerCase(), locale, source: source ?? 'home_band' }`
   via `createServerSupabase()`.
4. Unique violation `23505` → treat as success (already subscribed). Any other
   error → `500`.
5. Return `{ ok: true }`.

No Turnstile call in this slice (per decision). Rate-limit fails open, matching
`enforceRateLimit`'s documented behavior.

## Wire up `NewsletterBand`

`src/components/shop/NewsletterBand.tsx` currently calls `setDone(true)` in
`onSubmit`. Replace with a real submit:

- Read the active locale (`useLocale()` from `next-intl`, or pass it as a prop
  from the homepage — prop is preferred to keep the component pure; the homepage
  already resolves `locale`).
- On submit: `POST /api/newsletter` with `{ email, locale, source: 'home_band' }`.
- On `ok` (including the idempotent-duplicate case) → show the existing `thanks`
  message.
- On network/`500` error → show an inline error message (new i18n key
  `newsletter.error`) and let the fan retry. Keep a `pending` state to disable
  the button during the request.

## Admin access — `/admin/newsletter`

**Page** (`src/app/admin/newsletter/page.tsx`): server component, mirrors the
waitlists page. Loads subscribers via a new server query and renders the table +
a "Download CSV" button.

**Query** (`src/server/queries/admin-newsletter.ts`, `server-only`): `listNewsletterSubscribers()`
using `createServerSupabase()` (RLS scopes to owner/dev). Selects `email, locale,
source, status, created_at` ordered `created_at desc`. Returns a typed
`NewsletterSubscriber[]`.

**Table** (`src/components/admin/NewsletterTable.tsx`, client): mirrors
`WaitlistsTable`. Columns: **email · language · source · date**. Empty state.
i18n under `admin.newsletter`.

**CSV export** (`src/app/api/admin/newsletter/export/route.ts`): `GET` guarded by
`requireOwnerOrDev(await createServerSupabase())`. Builds `text/csv` with header
row `email,locale,source,status,created_at` and one row per subscriber, escaping
values (wrap in quotes, double embedded quotes). Responds with
`Content-Type: text/csv; charset=utf-8` and
`Content-Disposition: attachment; filename="newsletter-subscribers-YYYY-MM-DD.csv"`.
The admin page's "Download CSV" button links to this route.

**Nav**: add a `/admin/newsletter` entry to `AdminNav`.

## i18n

Add to `messages/en.json` and `messages/th.json`:

- `newsletter.error` — inline signup failure message (band).
- `admin.newsletter.*` — `title`, `description`, `empty`, `download`, and column
  headers `colEmail`, `colLanguage`, `colSource`, `colDate`.

The band's existing copy keys (`title`, `subtitle`, `placeholder`, `cta`,
`thanks`) already exist and are unchanged.

## Testing

Unit tests (Vitest), following existing patterns:

- **API route** (`tests/unit/.../newsletter-route.test.ts`): valid body inserts
  and returns `{ ok: true }`; malformed body → `400`; duplicate (`23505`) →
  `{ ok: true }`; rate-limit exceeded → `429`. Mock Supabase + `enforceRateLimit`
  as the existing route tests do.
- **CSV export** (`tests/unit/.../newsletter-export.test.ts`): correct header +
  rows, value escaping (commas/quotes in data), and that a non-owner is rejected.

The public insert and the admin-only export are the security-sensitive paths, so
both get coverage per the project's testing bar.

## Files touched

New:
- `supabase/migrations/<ts>_newsletter_subscribers.sql`
- `supabase/policies/newsletter.sql`
- `src/app/api/newsletter/route.ts`
- `src/app/api/admin/newsletter/export/route.ts`
- `src/app/admin/newsletter/page.tsx`
- `src/server/queries/admin-newsletter.ts`
- `src/components/admin/NewsletterTable.tsx`
- tests for the route + export

Modified:
- `src/components/shop/NewsletterBand.tsx` (real submit)
- `src/app/[locale]/page.tsx` (pass `locale` to the band, if prop approach)
- `src/components/admin/AdminNav.tsx` (nav link)
- `messages/en.json`, `messages/th.json`
- `src/db/types.gen.ts` (regenerated after the migration)
