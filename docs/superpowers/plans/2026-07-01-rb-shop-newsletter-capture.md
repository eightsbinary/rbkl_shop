# Newsletter Subscriber Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture fan/buyer emails from the public homepage into a database and give the admin a viewable + CSV-exportable list.

**Architecture:** Mirror the existing waitlist feature — a public `POST /api/newsletter` route (rate-limit → insert → idempotent on duplicate), an RLS-protected `newsletter_subscribers` table, and an `/admin/newsletter` page backed by a server query, plus an owner-only CSV export route.

**Tech Stack:** Next.js 16 (App Router, route handlers), Supabase Postgres + RLS, zod, next-intl, Vitest. Runtime is Bun in WSL: run all commands as `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun <cmd>"`.

---

## File Structure

New:
- `supabase/migrations/20260701120000_newsletter_subscribers.sql` — table, RLS, grants
- `supabase/policies/newsletter.sql` — review mirror of the policies
- `src/app/api/newsletter/route.ts` — public capture endpoint
- `src/app/api/admin/newsletter/export/route.ts` — owner-only CSV export
- `src/app/admin/newsletter/page.tsx` — admin list page
- `src/server/queries/admin-newsletter.ts` — `listNewsletterSubscribers()`
- `src/components/admin/NewsletterTable.tsx` — admin table (client)
- `tests/unit/server/newsletter-route.test.ts`
- `tests/unit/server/newsletter-export.test.ts`

Modified:
- `src/components/shop/NewsletterBand.tsx` — real submit
- `src/app/[locale]/page.tsx` — pass `locale` + `error` to the band
- `src/components/admin/AdminNav.tsx` — nav link
- `messages/en.json`, `messages/th.json` — i18n strings
- `src/db/types.gen.ts` — regenerated after migration

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260701120000_newsletter_subscribers.sql`
- Create: `supabase/policies/newsletter.sql`
- Modify (regenerated): `src/db/types.gen.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260701120000_newsletter_subscribers.sql`:

```sql
-- Newsletter: fans/buyers subscribe to receive product updates and news later.

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale text not null check (locale in ('th','en')),
  source text,
  status text not null default 'active' check (status in ('active','unsubscribed')),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique (email)
);

create index newsletter_subscribers_created_idx
  on public.newsletter_subscribers(created_at desc);

alter table public.newsletter_subscribers enable row level security;

-- anon/authenticated can subscribe (own email submitted via API)
create policy "newsletter_anon_insert"
on public.newsletter_subscribers for insert to anon, authenticated
with check (true);

-- owner/dev manage everything (list, export, prune)
create policy "newsletter_owner_dev_all"
on public.newsletter_subscribers for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Grants (mandatory for new-style sb_secret_ / sb_publishable_ keys)
grant insert on public.newsletter_subscribers to anon, authenticated;
grant select, insert, update, delete on public.newsletter_subscribers to authenticated, service_role;
```

- [ ] **Step 2: Write the policies review mirror**

Create `supabase/policies/newsletter.sql`:

```sql
-- Review mirror of supabase/migrations/20260701120000_newsletter_subscribers.sql.

alter table public.newsletter_subscribers enable row level security;

-- anon/authenticated can subscribe (own email submitted via API)
create policy "newsletter_anon_insert"
on public.newsletter_subscribers for insert to anon, authenticated
with check (true);

-- owner/dev manage everything (list, export, prune)
create policy "newsletter_owner_dev_all"
on public.newsletter_subscribers for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Grants (mandatory for new-style sb_secret_ / sb_publishable_ keys)
grant insert on public.newsletter_subscribers to anon, authenticated;
grant select, insert, update, delete on public.newsletter_subscribers to authenticated, service_role;
```

- [ ] **Step 3: Apply the migration to the local DB**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run db:reset"`
Expected: reset completes, applying all migrations including the new one, no errors.

- [ ] **Step 4: Regenerate DB types**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run db:types"`
Expected: `src/db/types.gen.ts` now contains a `newsletter_subscribers` entry. Verify with:
`wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && grep -c newsletter_subscribers src/db/types.gen.ts"` → prints a number ≥ 1.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260701120000_newsletter_subscribers.sql supabase/policies/newsletter.sql src/db/types.gen.ts
git commit -m "feat(newsletter): add newsletter_subscribers table + RLS"
```

---

## Task 2: Public capture route `/api/newsletter`

**Files:**
- Create: `src/app/api/newsletter/route.ts`
- Test: `tests/unit/server/newsletter-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/newsletter-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rateLimitMock, clientIpMock, insertMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(async () => ({ ok: true })),
  clientIpMock: vi.fn(async () => '1.2.3.4'),
  insertMock: vi.fn(async () => ({ error: null as { code: string } | null })),
}));

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: rateLimitMock, clientIp: clientIpMock }));
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => ({ from: () => ({ insert: insertMock }) }),
}));

import { POST } from '@/app/api/newsletter/route';

function req(body: unknown): Request {
  return new Request('http://localhost/api/newsletter', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/newsletter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ ok: true });
    insertMock.mockResolvedValue({ error: null });
  });

  it('stores a valid subscriber (lowercased) and returns ok', async () => {
    const res = await POST(req({ email: 'Fan@Example.com', locale: 'th' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({
      email: 'fan@example.com',
      locale: 'th',
      source: 'home_band',
    });
  });

  it('rejects malformed input with 400 and no insert', async () => {
    const res = await POST(req({ email: 'not-an-email', locale: 'th' }));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('treats a duplicate (23505) as success', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } });
    const res = await POST(req({ email: 'dup@example.com', locale: 'en' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('returns 429 when rate-limited, without inserting', async () => {
    rateLimitMock.mockResolvedValue({ ok: false });
    const res = await POST(req({ email: 'fan@example.com', locale: 'en' }));
    expect(res.status).toBe(429);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected DB error', async () => {
    insertMock.mockResolvedValue({ error: { code: '42P01' } });
    const res = await POST(req({ email: 'fan@example.com', locale: 'en' }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun x vitest run tests/unit/server/newsletter-route.test.ts"`
Expected: FAIL — cannot resolve `@/app/api/newsletter/route`.

- [ ] **Step 3: Write the route**

Create `src/app/api/newsletter/route.ts`:

```ts
import { NextResponse } from 'next/server';
import * as z from 'zod';
import { createServerSupabase } from '@/db/server';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

const Body = z.object({
  email: z.string().email(),
  locale: z.enum(['th', 'en']),
  source: z.string().max(50).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { email, locale, source } = parsed.data;

  const ip = await clientIp();
  const rl = await enforceRateLimit('newsletter', ip, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const supa = await createServerSupabase();
  const { error } = await supa.from('newsletter_subscribers').insert({
    email: email.toLowerCase(),
    locale,
    source: source ?? 'home_band',
  });

  // 23505 = unique violation → already subscribed, which is success from the fan's view.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not subscribe' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun x vitest run tests/unit/server/newsletter-route.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/newsletter/route.ts tests/unit/server/newsletter-route.test.ts
git commit -m "feat(newsletter): public capture route POST /api/newsletter"
```

---

## Task 3: Wire the homepage `NewsletterBand` to a real submit

**Files:**
- Modify: `src/components/shop/NewsletterBand.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `messages/en.json`, `messages/th.json` (add `landing.journalError`)

- [ ] **Step 1: Add the `journalError` i18n key (en)**

In `messages/en.json`, inside the `landing` object, add after `"journalThanks"`:

```json
    "journalError": "Something went wrong — please try again.",
```

(Ensure the preceding line ends with a comma and JSON stays valid.)

- [ ] **Step 2: Add the `journalError` i18n key (th)**

In `messages/th.json`, inside the `landing` object, add after `"journalThanks"`:

```json
    "journalError": "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
```

- [ ] **Step 3: Rewrite `NewsletterBand` to submit for real**

Replace the entire contents of `src/components/shop/NewsletterBand.tsx`:

```tsx
'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/routing';

/** Editorial "Journal" band. Captures the email via POST /api/newsletter
 *  (single opt-in) and shows a thank-you. */
export function NewsletterBand({
  locale,
  title,
  subtitle,
  placeholder,
  cta,
  thanks,
  error,
}: {
  locale: Locale;
  title: string;
  subtitle: string;
  placeholder: string;
  cta: string;
  thanks: string;
  error: string;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('pending');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, locale, source: 'home_band' }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="bg-ink-deep px-6 py-24 text-center text-paper">
      <div className="mx-auto max-w-xl space-y-5">
        <h2 className="font-serif text-3xl">{title}</h2>
        <p className="text-sm text-paper/70">{subtitle}</p>
        {status === 'done' ? (
          <p className="text-sm text-paper/90">{thanks}</p>
        ) : (
          <form className="flex flex-col items-center gap-3" onSubmit={onSubmit}>
            <div className="flex items-center justify-center gap-0">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                className="h-12 w-64 border border-paper/30 bg-transparent px-4 text-sm text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
              />
              <Button type="submit" variant="solid-paper" size="md" disabled={status === 'pending'}>
                {cta}
              </Button>
            </div>
            {status === 'error' && <p className="text-sm text-paper/80">{error}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Pass `locale` and `error` from the homepage**

In `src/app/[locale]/page.tsx`, replace the `<NewsletterBand ... />` block:

```tsx
      <NewsletterBand
        locale={locale}
        title={t('journalTitle')}
        subtitle={t('journalSubtitle')}
        placeholder={t('journalPlaceholder')}
        cta={t('journalCta')}
        thanks={t('journalThanks')}
        error={t('journalError')}
      />
```

- [ ] **Step 5: Verify typecheck + lint pass**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run typecheck && ~/.bun/bin/bun x biome check src/components/shop/NewsletterBand.tsx src/app/'[locale]'/page.tsx messages/en.json messages/th.json"`
Expected: typecheck clean; biome reports no errors on these files.

- [ ] **Step 6: Commit**

```bash
git add src/components/shop/NewsletterBand.tsx "src/app/[locale]/page.tsx" messages/en.json messages/th.json
git commit -m "feat(newsletter): wire homepage band to real signup endpoint"
```

---

## Task 4: Admin list page

**Files:**
- Create: `src/server/queries/admin-newsletter.ts`
- Create: `src/components/admin/NewsletterTable.tsx`
- Create: `src/app/admin/newsletter/page.tsx`
- Modify: `src/components/admin/AdminNav.tsx`
- Modify: `messages/en.json`, `messages/th.json`

- [ ] **Step 1: Add admin i18n strings (en)**

In `messages/en.json`, add a `newsletter` object inside the `admin` object (e.g. right after the `admin.waitlists` object — mind the commas):

```json
    "newsletter": {
      "title": "newsletter",
      "description": "Fans who signed up for product updates.",
      "empty": "No subscribers yet.",
      "download": "Download CSV",
      "colEmail": "email",
      "colLanguage": "language",
      "colSource": "source",
      "colDate": "date"
    },
```

Also add to `admin.nav` (after `"waitlists"`):

```json
      "newsletter": "newsletter",
```

- [ ] **Step 2: Add admin i18n strings (th)**

In `messages/th.json`, add inside the `admin` object:

```json
    "newsletter": {
      "title": "จดหมายข่าว",
      "description": "แฟน ๆ ที่สมัครรับข่าวสารสินค้า",
      "empty": "ยังไม่มีผู้สมัคร",
      "download": "ดาวน์โหลด CSV",
      "colEmail": "อีเมล",
      "colLanguage": "ภาษา",
      "colSource": "ที่มา",
      "colDate": "วันที่"
    },
```

Also add to `admin.nav` (after `"waitlists"`):

```json
      "newsletter": "จดหมายข่าว",
```

- [ ] **Step 3: Create the server query**

Create `src/server/queries/admin-newsletter.ts`:

```ts
import 'server-only';
import { createServerSupabase } from '@/db/server';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  locale: string;
  source: string | null;
  status: string;
  createdAt: string;
}

/** All newsletter subscribers, newest first. RLS restricts this to owner/dev. */
export async function listNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('newsletter_subscribers')
    .select('id, email, locale, source, status, created_at')
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    locale: r.locale,
    source: r.source,
    status: r.status,
    createdAt: r.created_at,
  }));
}
```

- [ ] **Step 4: Create the admin table component**

Create `src/components/admin/NewsletterTable.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import type { NewsletterSubscriber } from '@/server/queries/admin-newsletter';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function NewsletterTable({ subscribers }: { subscribers: NewsletterSubscriber[] }) {
  const t = useTranslations('admin.newsletter');
  if (subscribers.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  return (
    <div className="border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-5 py-4 font-medium">{t('colEmail')}</th>
            <th className="px-5 py-4 font-medium">{t('colLanguage')}</th>
            <th className="px-5 py-4 font-medium">{t('colSource')}</th>
            <th className="px-5 py-4 font-medium">{t('colDate')}</th>
          </tr>
        </thead>
        <tbody>
          {subscribers.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-0">
              <td className="px-5 py-4 text-ink">{s.email}</td>
              <td className="px-5 py-4 uppercase text-muted">{s.locale}</td>
              <td className="px-5 py-4 text-muted">{s.source ?? '—'}</td>
              <td className="px-5 py-4 text-muted">{dateFmt.format(new Date(s.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Create the admin page (with the CSV download button)**

Create `src/app/admin/newsletter/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server';
import { NewsletterTable } from '@/components/admin/NewsletterTable';
import { listNewsletterSubscribers } from '@/server/queries/admin-newsletter';

export default async function AdminNewsletterPage() {
  const t = await getTranslations('admin.newsletter');
  const subscribers = await listNewsletterSubscribers();

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
          <p className="text-sm text-muted">{t('description')}</p>
        </div>
        <a
          href="/api/admin/newsletter/export"
          className="border border-ink px-4 py-2 text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          {t('download')}
        </a>
      </div>
      <NewsletterTable subscribers={subscribers} />
    </div>
  );
}
```

- [ ] **Step 6: Add the nav link**

In `src/components/admin/AdminNav.tsx`, add to the `links` array after the `waitlists` entry:

```tsx
    { href: '/admin/newsletter', label: t('newsletter') },
```

- [ ] **Step 7: Verify typecheck + lint**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run typecheck && ~/.bun/bin/bun x biome check src/server/queries/admin-newsletter.ts src/components/admin/NewsletterTable.tsx src/app/admin/newsletter/page.tsx src/components/admin/AdminNav.tsx messages/en.json messages/th.json"`
Expected: typecheck clean; biome no errors on these files.

- [ ] **Step 8: Commit**

```bash
git add src/server/queries/admin-newsletter.ts src/components/admin/NewsletterTable.tsx src/app/admin/newsletter/page.tsx src/components/admin/AdminNav.tsx messages/en.json messages/th.json
git commit -m "feat(newsletter): admin list page at /admin/newsletter"
```

---

## Task 5: CSV export route

**Files:**
- Create: `src/app/api/admin/newsletter/export/route.ts`
- Test: `tests/unit/server/newsletter-export.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/newsletter-export.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';

const { requireMock, state } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  state: { rows: [] as Array<Record<string, unknown>> },
}));

vi.mock('@/db/auth', async (orig) => {
  const actual = await orig<typeof import('@/db/auth')>();
  return { ...actual, requireOwnerOrDev: requireMock };
});
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => ({
    from: () => ({ select: () => ({ order: async () => ({ data: state.rows }) }) }),
  }),
}));

import { GET } from '@/app/api/admin/newsletter/export/route';

describe('GET /api/admin/newsletter/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMock.mockResolvedValue(undefined);
    state.rows = [];
  });

  it('returns 403 for a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('streams CSV with header + escaped rows and attachment headers', async () => {
    state.rows = [
      { email: 'a@b.com', locale: 'th', source: 'home_band', status: 'active', created_at: '2026-07-01T00:00:00Z' },
      { email: 'c@d.com', locale: 'en', source: null, status: 'active', created_at: '2026-07-02T00:00:00Z' },
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const lines = (await res.text()).split('\r\n');
    expect(lines[0]).toBe('email,locale,source,status,created_at');
    expect(lines[1]).toBe('"a@b.com","th","home_band","active","2026-07-01T00:00:00Z"');
    expect(lines[2]).toBe('"c@d.com","en","","active","2026-07-02T00:00:00Z"');
  });

  it('escapes embedded quotes and commas', async () => {
    state.rows = [
      { email: 'weird"n@b.com', locale: 'th', source: 'a,b', status: 'active', created_at: '2026-07-01T00:00:00Z' },
    ];
    const body = await (await GET()).text();
    expect(body).toContain('"weird""n@b.com"');
    expect(body).toContain('"a,b"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun x vitest run tests/unit/server/newsletter-export.test.ts"`
Expected: FAIL — cannot resolve `@/app/api/admin/newsletter/export/route`.

- [ ] **Step 3: Write the export route**

Create `src/app/api/admin/newsletter/export/route.ts`:

```ts
import { ForbiddenError, requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supa = await createServerSupabase();
  try {
    await requireOwnerOrDev(supa);
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response('Forbidden', { status: 403 });
    throw err;
  }

  const { data } = await supa
    .from('newsletter_subscribers')
    .select('email, locale, source, status, created_at')
    .order('created_at', { ascending: false });

  const header = 'email,locale,source,status,created_at';
  const rows = (data ?? []).map((r) =>
    [r.email, r.locale, r.source ?? '', r.status, r.created_at].map(csvCell).join(','),
  );
  const csv = [header, ...rows].join('\r\n');

  const filename = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun x vitest run tests/unit/server/newsletter-export.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Full verification**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run typecheck && ~/.bun/bin/bun run test"`
Expected: typecheck clean; entire suite passes (previous 167 + 8 new = 175).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/newsletter/export/route.ts tests/unit/server/newsletter-export.test.ts
git commit -m "feat(newsletter): owner-only CSV export of subscribers"
```

---

## Manual verification (after all tasks)

1. Start the dev server; open the homepage `/en`, enter an email in the Journal band, submit → thank-you appears.
2. Check the row landed: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run db:types >/dev/null; echo 'inspect via Studio http://127.0.0.1:54323'"` — or view in Supabase Studio → `newsletter_subscribers`.
3. Log into `/admin`, open **Newsletter** in the nav → the email is listed.
4. Click **Download CSV** → a `newsletter-subscribers-<date>.csv` downloads with the row.
5. Confirm resubmitting the same email still shows the thank-you (idempotent, no duplicate row).
