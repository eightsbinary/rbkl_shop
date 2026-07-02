# rb_shop — Plan 2: Catalog

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bilingual storefront (TH default, EN switcher) with a 3-column Soft Studio product grid, a per-product detail page with variant selector, and an owner/dev admin to create + edit products (with variants, images, status). End state: rainbykello can add products in `/admin`, fans can browse + view PDPs at `/th` and `/en`.

**Architecture:** Locale routing via `next-intl` (`/th`, `/en`). New catalog tables (`products`, `variants`, `variant_options`, `product_images`) with RLS + service-role grants per the Plan 1 fix pattern. Supabase Storage bucket `product-images` with public-read + owner-write policies. Client-side image resize via browser Canvas (no server CPU, no Sharp dep). Server Actions for all admin writes; server-only queries for storefront reads. Hand-rolled minimal UI primitives (no shadcn CLI dep) — Button, Input, Label, Card, Textarea, Select.

**Tech Stack additions:** `next-intl` 4.x (i18n routing), browser `CanvasImageSource` (no new deps), `nanoid` (for storage object keys).

**Spec reference:** `docs/superpowers/specs/2026-06-26-rb-shop-design.md` §4 (data model), §6.4 (admin add product), §7 (Soft Studio aesthetic + 3-col grid).

**Locked decisions for this plan:**
- Default locale: **Thai** (`/th` is root; `/` redirects to `/th`).
- Landing: **Hero + featured-products 3-card row** (products with `is_featured = true`).
- Image resize: **client-side Canvas** → 400 / 800 / 1600 webp uploads.
- Variant axes: **size + color** (D2 in spec, locked).
- Featured flag: new boolean `products.is_featured`.

---

## File structure built by this plan

```
rb_shop/
├── messages/
│   ├── en.json
│   └── th.json
├── src/
│   ├── app/
│   │   ├── [locale]/                           (re-rooted storefront)
│   │   │   ├── layout.tsx                      (locale provider, header, footer)
│   │   │   ├── page.tsx                        (landing: hero + featured grid)
│   │   │   ├── shop/page.tsx                   (full product list, 3-col grid)
│   │   │   └── product/[slug]/page.tsx         (PDP w/ variant selector)
│   │   ├── admin/                              (NOT under [locale] — admin is single-locale TH)
│   │   │   ├── layout.tsx                      (gating + admin nav)
│   │   │   ├── page.tsx                        (admin dashboard)
│   │   │   ├── login/page.tsx                  (magic-link request stub)
│   │   │   └── products/
│   │   │       ├── page.tsx                    (list + 'New product' button)
│   │   │       ├── new/page.tsx                (create form)
│   │   │       └── [id]/edit/page.tsx          (edit form)
│   │   └── api/
│   │       └── storage/sign-upload/route.ts    (signed upload URL endpoint)
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Label.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Textarea.tsx
│   │   │   └── Select.tsx
│   │   ├── shop/
│   │   │   ├── Header.tsx                      (logo + nav + locale switch + cart placeholder)
│   │   │   ├── Footer.tsx
│   │   │   ├── ProductGrid.tsx                 (3-col responsive)
│   │   │   ├── ProductCard.tsx
│   │   │   ├── PDP.tsx                         (product detail layout)
│   │   │   ├── VariantSelector.tsx
│   │   │   └── LocaleSwitcher.tsx
│   │   └── admin/
│   │       ├── AdminNav.tsx
│   │       ├── ProductForm.tsx
│   │       ├── VariantMatrix.tsx
│   │       └── ImagePicker.tsx                 (client-side resize + upload)
│   ├── server/
│   │   ├── actions/
│   │   │   ├── products.ts                     (create/update/archive)
│   │   │   └── storage.ts                      (signed-url issuance)
│   │   └── queries/
│   │       └── products.ts                     (list/get for storefront)
│   ├── domain/
│   │   ├── slugify.ts                          (NEW, TDD)
│   │   └── variant-matrix.ts                   (NEW, TDD — derive variants from axes)
│   ├── lib/
│   │   ├── i18n.ts                             (next-intl config)
│   │   └── images.ts                           (client-side Canvas resize, TDD)
│   ├── i18n/
│   │   ├── routing.ts                          (next-intl routing config)
│   │   └── request.ts                          (server message loader)
│   └── middleware.ts                           (locale routing + admin gating)
├── supabase/
│   ├── migrations/
│   │   ├── 20260626001000_catalog.sql
│   │   ├── 20260626001100_catalog_rls.sql
│   │   └── 20260626001200_catalog_storage.sql
│   └── policies/
│       └── catalog.sql                         (review mirror)
└── tests/
    ├── unit/
    │   ├── domain/
    │   │   ├── slugify.test.ts
    │   │   └── variant-matrix.test.ts
    │   └── lib/
    │       └── images.test.ts
    └── e2e/
        └── catalog.smoke.spec.ts               (admin creates → storefront shows)
```

---

## Conventions (carry-over from Plan 1)

- WSL Ubuntu host. Bun at `~/.bun/bin/bun`. Bash tool runs Git Bash; wrap with `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ..."` when running bun/node.
- Supabase CLI at `~/.local/bin/supabase` (symlinked to supabase-go). Stack running locally: URL `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`.
- `import * as z from 'zod'` (not `import { z }`).
- Tailwind v4 with `@theme` tokens; Soft Studio palette locked.
- Biome v2 strict; LF line endings enforced.
- TDD for domain logic + lib/images. UI components are not TDD (Vitest happy-dom can render, but we'll cover those in Plan 6 polish E2E).
- Every task ends with a commit on `develop`.
- Each migration that creates new public tables MUST add grants for `service_role` (and `authenticated` where appropriate) — Plan 1 task 14 omission cost us; not happening again.

---

## Task 1: Install next-intl + i18n config files

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/lib/i18n.ts`, `messages/en.json`, `messages/th.json`
- Modify: `package.json`, `src/middleware.ts` (new), `next.config.ts`

- [ ] **Step 1: Install next-intl**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun add next-intl"
```
Expected: `next-intl@4.x` added.

- [ ] **Step 2: Create `src/i18n/routing.ts`**

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['th', 'en'] as const,
  defaultLocale: 'th',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 3: Create `src/i18n/request.ts`**

```ts
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: Create message files**

`messages/th.json`:
```json
{
  "brand": {
    "name": "rainbykello",
    "tagline": "ทำอย่างใส่ใจ ส่งอย่างอบอุ่น"
  },
  "nav": {
    "shop": "ร้านค้า",
    "about": "เกี่ยวกับ",
    "cart": "ตะกร้า"
  },
  "landing": {
    "heroLine1": "ทำอย่างใส่ใจ",
    "heroLine2": "ส่งอย่างอบอุ่น",
    "featuredTitle": "คอลเลกชันล่าสุด",
    "viewAll": "ดูทั้งหมด"
  },
  "shop": {
    "title": "ร้านค้า",
    "emptyState": "ยังไม่มีสินค้าในขณะนี้",
    "soldOut": "ขายหมดแล้ว",
    "notify": "แจ้งเตือนเมื่อกลับมาขาย"
  },
  "pdp": {
    "addToCart": "หยิบใส่ตะกร้า",
    "size": "ขนาด",
    "color": "สี",
    "selectSize": "เลือกขนาด",
    "selectColor": "เลือกสี",
    "outOfStock": "ขายหมด"
  },
  "footer": {
    "copyright": "© รังบายเคลโล่",
    "follow": "ติดตาม"
  },
  "locale": {
    "switchToEnglish": "EN"
  }
}
```

`messages/en.json`:
```json
{
  "brand": {
    "name": "rainbykello",
    "tagline": "made slowly, shipped warmly"
  },
  "nav": {
    "shop": "shop",
    "about": "about",
    "cart": "cart"
  },
  "landing": {
    "heroLine1": "made slowly,",
    "heroLine2": "shipped warmly",
    "featuredTitle": "latest drop",
    "viewAll": "view all"
  },
  "shop": {
    "title": "shop",
    "emptyState": "nothing in the shop right now",
    "soldOut": "sold out",
    "notify": "notify me when back"
  },
  "pdp": {
    "addToCart": "add to cart",
    "size": "size",
    "color": "color",
    "selectSize": "select size",
    "selectColor": "select color",
    "outOfStock": "out of stock"
  },
  "footer": {
    "copyright": "© rainbykello",
    "follow": "follow"
  },
  "locale": {
    "switchToEnglish": "TH"
  }
}
```

- [ ] **Step 5: Wire next-intl plugin in `next.config.ts`**

Replace contents:
```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // future Next.js config additions go here
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Create `src/lib/i18n.ts` re-export**

```ts
export { routing, type Locale } from '@/i18n/routing';
```

- [ ] **Step 7: Lint + typecheck + test**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint && ~/.bun/bin/bun run typecheck && ~/.bun/bin/bun run test"
```
Expected: all green. 48 tests still pass.

- [ ] **Step 8: Commit**

```bash
git add . && git commit -m "feat(i18n): next-intl routing + TH/EN messages (TH default)"
```

---

## Task 2: Middleware for locale routing + admin gating prep

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement**

```ts
import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes are single-locale (TH copy in UI) and gated separately
  // via per-route checks. Skip i18n rewriting for /admin and /api.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all paths except: static assets, _next, favicon, well-known
    '/((?!_next|.*\\..*).*)',
  ],
};
```

- [ ] **Step 2: Verify build**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run build 2>&1 | tail -10"
```
Expected: builds clean. Routes preview shows the existing `/` (we haven't moved app yet — Task 3 does that).

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(i18n): middleware — locale rewrite for storefront, passthrough for /admin + /api"
```

---

## Task 3: Re-root storefront under `app/[locale]/`

**Files:**
- Move: `src/app/page.tsx` → `src/app/[locale]/page.tsx`
- Modify: `src/app/layout.tsx` → stays as root layout for ALL routes (html/body)
- Create: `src/app/[locale]/layout.tsx` (locale provider)
- Keep: `src/app/globals.css`

- [ ] **Step 1: Update root `src/app/layout.tsx` (minimal — just html/body/fonts)**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'rainbykello',
  description: 'merchandise — made slowly, shipped warmly',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

(`html` no longer has `lang` — the `[locale]` layout sets it.)

- [ ] **Step 2: Create `src/app/[locale]/layout.tsx`**

```tsx
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Header } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider locale={locale}>
      <Header />
      <main id="main" className="min-h-[calc(100vh-12rem)]">
        {children}
      </main>
      <Footer />
    </NextIntlClientProvider>
  );
}
```

(`Header` and `Footer` are created in Task 12.)

- [ ] **Step 3: Move `src/app/page.tsx` → `src/app/[locale]/page.tsx` and update**

Delete the old `src/app/page.tsx`, create `src/app/[locale]/page.tsx`:
```tsx
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');

  return (
    <section className="px-6 py-32 text-center space-y-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">rb_shop</p>
      <h1 className="font-serif text-5xl md:text-7xl text-ink">
        {t('heroLine1')}
        <br />
        {t('heroLine2')}
      </h1>
      {/* Featured grid placeholder — wired up in Task 13 */}
    </section>
  );
}
```

- [ ] **Step 4: Add temporary inline Header/Footer stubs so build works before Task 12**

Create `src/components/shop/Header.tsx`:
```tsx
export function Header() {
  return <header className="border-b border-line" />;
}
```

Create `src/components/shop/Footer.tsx`:
```tsx
export function Footer() {
  return <footer className="border-t border-line" />;
}
```

(These get fleshed out in Task 12; we just need the imports to resolve now.)

- [ ] **Step 5: Verify build**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run build 2>&1 | tail -15"
```
Expected: routes include `/th`, `/en` (static pre-rendered).

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(i18n): re-root storefront under app/[locale]/; add header/footer stubs"
```

---

## Task 4: Catalog migration — products, variants, options, images

**Files:**
- Create: `supabase/migrations/20260626001000_catalog.sql`

- [ ] **Step 1: Write migration**

```sql
-- Catalog: products + variant axes + variants + product images
-- Storage bucket policies live in a separate migration (Task 6).

create type public.product_status as enum ('draft', 'active', 'archived');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.product_status not null default 'draft',
  name jsonb not null,                 -- { th: "...", en: "..." }
  description jsonb not null default '{}'::jsonb,
  base_price_thb int not null check (base_price_thb >= 0),
  weight_grams int not null default 0 check (weight_grams >= 0),
  category text,
  is_featured boolean not null default false,
  hero_image_id uuid,                  -- FK added later (forward ref)
  version int not null default 1,      -- optimistic concurrency
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_status_idx on public.products(status);
create index products_featured_idx on public.products(is_featured) where is_featured;
create index products_slug_idx on public.products(slug);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table public.variant_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,                  -- 'size' | 'color' | etc.
  values text[] not null,              -- ['S','M','L','XL']
  sort int not null default 0,
  unique (product_id, name)
);

create index variant_options_product_idx on public.variant_options(product_id);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  option_values jsonb not null,        -- { size: 'M', color: 'cream' }
  price_thb int,                       -- null = use product.base_price_thb
  stock_available int not null default 0 check (stock_available >= 0),
  stock_reserved int not null default 0 check (stock_reserved >= 0),
  is_active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index variants_product_idx on public.variants(product_id);
create index variants_active_idx on public.variants(is_active) where is_active;

create trigger variants_set_updated_at
before update on public.variants
for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sort int not null default 0,
  storage_path text not null,           -- e.g. 'products/<uuid>/<nanoid>.webp'
  url_400 text not null,
  url_800 text not null,
  url_1600 text not null,
  alt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images(product_id, sort);

-- Now we can add the FK from products.hero_image_id
alter table public.products
  add constraint products_hero_image_fk
  foreign key (hero_image_id) references public.product_images(id) on delete set null;
```

- [ ] **Step 2: Apply locally**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/supabase db reset 2>&1 | tail -10"
```
Expected: 4 migrations apply cleanly.

- [ ] **Step 3: Re-bootstrap dev user** (db reset wipes it)

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && cat > /tmp/bootstrap-dev.ts <<'EOF'
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: created } = await supa.auth.admin.createUser({ email: 'dev@example.com', email_confirm: true });
console.log('User:', created.user!.id);
EOF
~/.bun/bin/bun run /tmp/bootstrap-dev.ts && ~/.bun/bin/bun run grant:dev -- dev@example.com"
```
Expected: dev role granted.

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(db): catalog tables — products, variants, options, images"
```

---

## Task 5: Catalog RLS + service_role grants

**Files:**
- Create: `supabase/migrations/20260626001100_catalog_rls.sql`, `supabase/policies/catalog.sql` (review mirror)

- [ ] **Step 1: Write migration**

```sql
-- Enable RLS
alter table public.products enable row level security;
alter table public.variant_options enable row level security;
alter table public.variants enable row level security;
alter table public.product_images enable row level security;

-- ── products ──────────────────────────────────────────
-- anon + authenticated: see only active
create policy "products_public_read"
on public.products for select
to anon, authenticated
using (status = 'active');

-- owner + dev: full access
create policy "products_owner_dev_all"
on public.products for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- ── variants ──────────────────────────────────────────
create policy "variants_public_read"
on public.variants for select
to anon, authenticated
using (
  is_active and exists (
    select 1 from public.products p
    where p.id = variants.product_id and p.status = 'active'
  )
);

create policy "variants_owner_dev_all"
on public.variants for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- ── variant_options ───────────────────────────────────
create policy "variant_options_public_read"
on public.variant_options for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = variant_options.product_id and p.status = 'active'
  )
);

create policy "variant_options_owner_dev_all"
on public.variant_options for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- ── product_images ────────────────────────────────────
create policy "product_images_public_read"
on public.product_images for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.status = 'active'
  )
);

create policy "product_images_owner_dev_all"
on public.product_images for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- ── Grants (mandatory for new-style API keys) ─────────
grant select on public.products, public.variants, public.variant_options, public.product_images
  to anon, authenticated;

grant select, insert, update, delete
  on public.products, public.variants, public.variant_options, public.product_images
  to authenticated, service_role;
```

- [ ] **Step 2: Mirror to `supabase/policies/catalog.sql`** (same content)

- [ ] **Step 3: Apply + bootstrap**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/supabase db reset 2>&1 | tail -5 && ~/.bun/bin/bun run /tmp/bootstrap-dev.ts && ~/.bun/bin/bun run grant:dev -- dev@example.com"
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(db): catalog RLS + grants (public-read active; owner/dev manage)"
```

---

## Task 6: Storage bucket for product images

**Files:**
- Create: `supabase/migrations/20260626001200_catalog_storage.sql`

- [ ] **Step 1: Write migration**

```sql
-- Public-read bucket for product images. Owners/devs write via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  3145728,                                -- 3 MiB per file (post-resize)
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Anyone can read
create policy "product_images_public_select"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

-- Only owner/dev can insert
create policy "product_images_owner_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_owner_or_dev());

-- Only owner/dev can delete
create policy "product_images_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_owner_or_dev());
```

- [ ] **Step 2: Apply + bootstrap**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/supabase db reset 2>&1 | tail -5 && ~/.bun/bin/bun run /tmp/bootstrap-dev.ts && ~/.bun/bin/bun run grant:dev -- dev@example.com"
```

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(db): storage bucket 'product-images' with public-read + owner-write"
```

---

## Task 7: Regenerate DB types

**Files:**
- Modify: `src/db/types.gen.ts` (regenerated)

- [ ] **Step 1: Regenerate**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run db:types"
```
Expected: writes new types.gen.ts with `products`, `variants`, `variant_options`, `product_images`, `product_status` enum.

- [ ] **Step 2: Typecheck + lint**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run typecheck && ~/.bun/bin/bun run lint"
```
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/db/types.gen.ts && git commit -m "chore(db): regenerate types for catalog tables"
```

---

## Task 8: Domain — `slugify` (TDD)

**Files:**
- Create: `tests/unit/domain/slugify.test.ts`, `src/domain/slugify.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { slugify } from '@/domain/slugify';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Summer Tee')).toBe('summer-tee');
  });

  it('strips non-alphanumerics except hyphens', () => {
    expect(slugify("Bunny's Hoodie! 2026")).toBe('bunnys-hoodie-2026');
  });

  it('collapses runs of hyphens', () => {
    expect(slugify('a   b -- c')).toBe('a-b-c');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  —hello—  ')).toBe('hello');
  });

  it('transliterates basic accents', () => {
    expect(slugify('Café')).toBe('cafe');
  });

  it('falls back to product id prefix for unsupportable strings', () => {
    expect(slugify('ภาษาไทย', { fallback: 'product-abc123' })).toBe('product-abc123');
  });

  it('returns empty when input is empty and no fallback given', () => {
    expect(slugify('')).toBe('');
  });
});
```

- [ ] **Step 2: Run — fails**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run test 2>&1 | tail -5"
```

- [ ] **Step 3: Implement `src/domain/slugify.ts`**

```ts
export interface SlugifyOptions {
  readonly fallback?: string;
}

export function slugify(input: string, opts: SlugifyOptions = {}): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length === 0 && opts.fallback) return opts.fallback;
  return slug;
}
```

- [ ] **Step 4: Run — pass**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run test 2>&1 | tail -5"
```

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat(domain): slugify with diacritic strip + fallback"
```

---

## Task 9: Domain — variant matrix generator (TDD)

**Files:**
- Create: `tests/unit/domain/variant-matrix.test.ts`, `src/domain/variant-matrix.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { generateVariants, type VariantAxis } from '@/domain/variant-matrix';

const axes: VariantAxis[] = [
  { name: 'size', values: ['S', 'M', 'L'] },
  { name: 'color', values: ['cream', 'sand'] },
];

describe('generateVariants', () => {
  it('produces the cartesian product as variant draft rows', () => {
    const variants = generateVariants(axes);
    expect(variants).toHaveLength(6);
    expect(variants[0]).toEqual({ optionValues: { size: 'S', color: 'cream' } });
    expect(variants[5]).toEqual({ optionValues: { size: 'L', color: 'sand' } });
  });

  it('returns single-row matrix for one axis', () => {
    const v = generateVariants([{ name: 'size', values: ['One Size'] }]);
    expect(v).toEqual([{ optionValues: { size: 'One Size' } }]);
  });

  it('returns empty array for empty axes', () => {
    expect(generateVariants([])).toEqual([]);
  });

  it('skips axes with no values', () => {
    expect(generateVariants([{ name: 'size', values: [] }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement `src/domain/variant-matrix.ts`**

```ts
export interface VariantAxis {
  readonly name: string;
  readonly values: ReadonlyArray<string>;
}

export interface VariantDraft {
  readonly optionValues: Record<string, string>;
}

export function generateVariants(axes: ReadonlyArray<VariantAxis>): VariantDraft[] {
  if (axes.length === 0) return [];
  if (axes.some((a) => a.values.length === 0)) return [];

  return axes.reduce<VariantDraft[]>(
    (acc, axis) => {
      if (acc.length === 0) {
        return axis.values.map((v) => ({ optionValues: { [axis.name]: v } }));
      }
      return acc.flatMap((existing) =>
        axis.values.map((v) => ({
          optionValues: { ...existing.optionValues, [axis.name]: v },
        })),
      );
    },
    [],
  );
}
```

- [ ] **Step 4: Run — pass + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run test"
git add . && git commit -m "feat(domain): variant matrix generator (cartesian product of axes)"
```

---

## Task 10: Lib — client-side image resize (TDD with mocked canvas)

**Files:**
- Create: `tests/unit/lib/images.test.ts`, `src/lib/images.ts`

The actual Canvas calls only run in the browser, so we test the pure logic (size selection, target dimensions) and stub the canvas IO.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { computeTargetSize, IMAGE_SIZES } from '@/lib/images';

describe('computeTargetSize', () => {
  it('preserves aspect ratio when shrinking', () => {
    expect(computeTargetSize({ width: 2000, height: 1000 }, 800)).toEqual({
      width: 800,
      height: 400,
    });
  });

  it('does not upscale smaller images', () => {
    expect(computeTargetSize({ width: 500, height: 250 }, 800)).toEqual({
      width: 500,
      height: 250,
    });
  });

  it('rounds dimensions to integers', () => {
    expect(computeTargetSize({ width: 1234, height: 567 }, 800)).toEqual({
      width: 800,
      height: 368, // round(567 * 800 / 1234)
    });
  });
});

describe('IMAGE_SIZES', () => {
  it('exposes 400/800/1600 ladder', () => {
    expect(IMAGE_SIZES).toEqual([400, 800, 1600]);
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement `src/lib/images.ts`**

```ts
export const IMAGE_SIZES = [400, 800, 1600] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export function computeTargetSize(source: Dimensions, maxWidth: number): Dimensions {
  if (source.width <= maxWidth) return source;
  const ratio = maxWidth / source.width;
  return {
    width: maxWidth,
    height: Math.round(source.height * ratio),
  };
}

/**
 * Client-side resize a File to a webp Blob at the given max-width.
 * Uses the browser Canvas API — throws if called server-side.
 */
export async function resizeImageToWebp(file: File, maxWidth: number, quality = 0.9): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('resizeImageToWebp must be called in the browser');
  }
  const bitmap = await createImageBitmap(file);
  const target = computeTargetSize({ width: bitmap.width, height: bitmap.height }, maxWidth);
  const canvas = new OffscreenCanvas(target.width, target.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  return await canvas.convertToBlob({ type: 'image/webp', quality });
}
```

- [ ] **Step 4: Run — pass + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run test"
git add . && git commit -m "feat(lib): client-side image resize (Canvas → webp, 400/800/1600 ladder)"
```

---

## Task 11: Hand-rolled UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/Label.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Textarea.tsx`, `src/components/ui/Select.tsx`

These are small focused primitives. Each is a single file ≤ 60 lines.

- [ ] **Step 1: `Button.tsx`**

```tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  secondary: 'bg-paper-warm text-ink hover:bg-line border border-line',
  ghost: 'bg-transparent text-ink hover:bg-paper-warm',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-13 px-7 text-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-md font-medium tracking-tight transition-all duration-150 ease-out-soft active:translate-y-0 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    />
  );
});
```

- [ ] **Step 2: `Input.tsx`**

```tsx
import { type InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink placeholder:text-muted transition-colors duration-150 ease-out-soft focus:outline-none focus:border-rose ${className}`}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 3: `Label.tsx`**

```tsx
import { type LabelHTMLAttributes } from 'react';

export function Label({ className = '', ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium text-ink-soft ${className}`} {...rest} />;
}
```

- [ ] **Step 4: `Card.tsx`**

```tsx
import { type HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-line bg-paper p-6 ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Step 5: `Textarea.tsx`**

```tsx
import { type TextareaHTMLAttributes, forwardRef } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`min-h-32 w-full rounded-md border border-line bg-paper px-3 py-2 text-base text-ink placeholder:text-muted transition-colors duration-150 ease-out-soft focus:outline-none focus:border-rose ${className}`}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 6: `Select.tsx`**

```tsx
import { type SelectHTMLAttributes, forwardRef } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`h-11 w-full rounded-md border border-line bg-paper px-3 text-base text-ink transition-colors duration-150 ease-out-soft focus:outline-none focus:border-rose ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
```

- [ ] **Step 7: Lint + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run typecheck"
git add . && git commit -m "feat(ui): minimal UI primitives — Button, Input, Label, Card, Textarea, Select"
```

---

## Task 12: Header, Footer, Locale switcher

**Files:**
- Modify: `src/components/shop/Header.tsx`, `src/components/shop/Footer.tsx`
- Create: `src/components/shop/LocaleSwitcher.tsx`

- [ ] **Step 1: `LocaleSwitcher.tsx`**

```tsx
'use client';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === 'th' ? 'en' : 'th';
  // Replace the leading locale segment in pathname
  const next = pathname.replace(/^\/(th|en)(\/|$)/, `/${other}$2`);
  return (
    <Link
      href={next || `/${other}`}
      className="text-xs uppercase tracking-[0.2em] text-muted hover:text-ink transition-colors duration-150 ease-out-soft"
    >
      {other.toUpperCase()}
    </Link>
  );
}
```

- [ ] **Step 2: `Header.tsx`**

```tsx
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Header() {
  const locale = useLocale();
  const t = useTranslations('nav');
  return (
    <header className="border-b border-line">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link
          href={`/${locale}`}
          className="font-serif text-xl text-ink hover:text-rose-deep transition-colors duration-150 ease-out-soft"
        >
          rainbykello
        </Link>
        <nav className="flex items-center gap-8 text-sm text-ink-soft">
          <Link
            href={`/${locale}/shop`}
            className="hover:text-ink transition-colors duration-150 ease-out-soft"
          >
            {t('shop')}
          </Link>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `Footer.tsx`**

```tsx
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer className="border-t border-line">
      <div className="container mx-auto flex h-20 items-center justify-between px-6 text-sm text-muted">
        <p>{t('copyright')} {new Date().getFullYear()}</p>
        <div className="flex items-center gap-4">
          <a href="https://www.instagram.com/rainbykello/" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">IG</a>
          <a href="https://www.twitch.tv/rainbykello" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">Twitch</a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Lint + build + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run build 2>&1 | tail -10"
git add . && git commit -m "feat(ui): header w/ locale switcher + footer w/ socials"
```

---

## Task 13: Server queries for storefront

**Files:**
- Create: `src/server/queries/products.ts`

- [ ] **Step 1: Implement**

```ts
import 'server-only';
import { createServerSupabase } from '@/db/client';
import type { Database } from '@/db/types.gen';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ImageRow = Database['public']['Tables']['product_images']['Row'];
type VariantRow = Database['public']['Tables']['variants']['Row'];

export interface ProductCardData {
  id: string;
  slug: string;
  name: { th?: string; en?: string };
  basePriceThb: number;
  heroImage: Pick<ImageRow, 'url_400' | 'url_800' | 'url_1600' | 'alt'> | null;
}

export async function listActiveProducts(limit = 24): Promise<ProductCardData[]> {
  const supa = await createServerSupabase();
  const { data, error } = await supa
    .from('products')
    .select('id, slug, name, base_price_thb, hero_image:product_images!products_hero_image_fk(url_400, url_800, url_1600, alt)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name as { th?: string; en?: string },
    basePriceThb: p.base_price_thb,
    heroImage: Array.isArray(p.hero_image) ? p.hero_image[0] ?? null : (p.hero_image as ImageRow | null),
  }));
}

export async function listFeaturedProducts(limit = 3): Promise<ProductCardData[]> {
  const supa = await createServerSupabase();
  const { data, error } = await supa
    .from('products')
    .select('id, slug, name, base_price_thb, hero_image:product_images!products_hero_image_fk(url_400, url_800, url_1600, alt)')
    .eq('status', 'active')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name as { th?: string; en?: string },
    basePriceThb: p.base_price_thb,
    heroImage: Array.isArray(p.hero_image) ? p.hero_image[0] ?? null : (p.hero_image as ImageRow | null),
  }));
}

export interface ProductDetailData {
  product: ProductRow;
  images: ImageRow[];
  variants: VariantRow[];
  options: { name: string; values: string[] }[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetailData | null> {
  const supa = await createServerSupabase();
  const { data: product, error } = await supa
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !product) return null;

  const [images, variants, options] = await Promise.all([
    supa.from('product_images').select('*').eq('product_id', product.id).order('sort'),
    supa.from('variants').select('*').eq('product_id', product.id).eq('is_active', true),
    supa.from('variant_options').select('name, values').eq('product_id', product.id).order('sort'),
  ]);
  return {
    product,
    images: images.data ?? [],
    variants: variants.data ?? [],
    options: (options.data ?? []) as { name: string; values: string[] }[],
  };
}
```

- [ ] **Step 2: Install server-only**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun add server-only"
```

- [ ] **Step 3: Typecheck + lint + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run typecheck"
git add . && git commit -m "feat(server): storefront product queries — list active, list featured, get by slug"
```

---

## Task 14: `ProductGrid` + `ProductCard`

**Files:**
- Create: `src/components/shop/ProductGrid.tsx`, `src/components/shop/ProductCard.tsx`

- [ ] **Step 1: `ProductCard.tsx`**

```tsx
import Link from 'next/link';
import Image from 'next/image';
import type { ProductCardData } from '@/server/queries/products';

export function ProductCard({ product, locale }: { product: ProductCardData; locale: 'th' | 'en' }) {
  const name = product.name[locale] ?? product.name.en ?? product.name.th ?? product.slug;
  const altObj = product.heroImage?.alt as { th?: string; en?: string } | undefined;
  const alt = altObj?.[locale] ?? altObj?.en ?? name;

  return (
    <Link
      href={`/${locale}/product/${product.slug}`}
      className="group block space-y-3"
    >
      <div className="aspect-square overflow-hidden rounded-md bg-paper-warm">
        {product.heroImage ? (
          <Image
            src={product.heroImage.url_800}
            alt={alt}
            width={800}
            height={800}
            className="h-full w-full object-cover transition-transform duration-220 ease-out-soft group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full bg-line" />
        )}
      </div>
      <div className="space-y-1">
        <p className="font-serif text-lg text-ink">{name}</p>
        <p className="text-sm text-muted">฿{product.basePriceThb.toLocaleString()}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: `ProductGrid.tsx`**

```tsx
import type { ProductCardData } from '@/server/queries/products';
import { ProductCard } from './ProductCard';

export function ProductGrid({
  products,
  locale,
}: {
  products: ProductCardData[];
  locale: 'th' | 'en';
}) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Configure Next.js image remote pattern for Supabase**

Edit `next.config.ts`:
```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '54321' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 4: Commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run typecheck"
git add . && git commit -m "feat(ui): 3-column ProductGrid + ProductCard + Next.js image config"
```

---

## Task 15: Wire landing page (hero + featured grid)

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Replace contents**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { listFeaturedProducts } from '@/server/queries/products';
import type { Locale } from '@/i18n/routing';
import Link from 'next/link';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const featured = await listFeaturedProducts(3);

  return (
    <>
      <section className="container mx-auto px-6 pt-24 pb-16 text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">rainbykello</p>
        <h1 className="font-serif text-5xl md:text-7xl text-ink leading-tight">
          {t('heroLine1')}
          <br />
          {t('heroLine2')}
        </h1>
      </section>

      {featured.length > 0 && (
        <section className="container mx-auto px-6 pb-24 space-y-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-ink">{t('featuredTitle')}</h2>
            <Link
              href={`/${locale}/shop`}
              className="text-sm uppercase tracking-[0.2em] text-muted hover:text-ink transition-colors"
            >
              {t('viewAll')}
            </Link>
          </div>
          <ProductGrid products={featured} locale={locale} />
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run build 2>&1 | tail -10"
git add . && git commit -m "feat(storefront): landing page with hero + featured products grid"
```

---

## Task 16: `/shop` listing page

**Files:**
- Create: `src/app/[locale]/shop/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { listActiveProducts } from '@/server/queries/products';
import type { Locale } from '@/i18n/routing';

export default async function ShopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('shop');
  const products = await listActiveProducts();

  return (
    <section className="container mx-auto px-6 py-16 space-y-12">
      <h1 className="font-serif text-4xl text-ink">{t('title')}</h1>
      {products.length === 0 ? (
        <p className="text-muted">{t('emptyState')}</p>
      ) : (
        <ProductGrid products={products} locale={locale} />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run build 2>&1 | tail -8"
git add . && git commit -m "feat(storefront): /shop full product listing page"
```

---

## Task 17: PDP + variant selector

**Files:**
- Create: `src/components/shop/PDP.tsx`, `src/components/shop/VariantSelector.tsx`, `src/app/[locale]/product/[slug]/page.tsx`

- [ ] **Step 1: `VariantSelector.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import type { Database } from '@/db/types.gen';

type Variant = Database['public']['Tables']['variants']['Row'];

export function VariantSelector({
  options,
  variants,
  basePriceThb,
}: {
  options: { name: string; values: string[] }[];
  variants: Variant[];
  basePriceThb: number;
}) {
  const t = useTranslations('pdp');
  const [selection, setSelection] = useState<Record<string, string>>({});

  const matched = variants.find((v) => {
    const vals = v.option_values as Record<string, string>;
    return options.every((o) => vals[o.name] === selection[o.name]);
  });
  const ready = options.every((o) => selection[o.name]);
  const inStock = matched && matched.stock_available > 0;
  const price = matched?.price_thb ?? basePriceThb;

  return (
    <div className="space-y-6">
      {options.map((opt) => (
        <div key={opt.name} className="space-y-2">
          <Label>{t(opt.name === 'size' ? 'size' : 'color')}</Label>
          <div className="flex flex-wrap gap-2">
            {opt.values.map((v) => {
              const isSelected = selection[opt.name] === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSelection({ ...selection, [opt.name]: v })}
                  className={`h-11 min-w-11 rounded-md border px-3 text-sm transition-all duration-150 ease-out-soft ${
                    isSelected
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-paper text-ink hover:border-rose'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-2">
        <p className="font-serif text-2xl text-ink">฿{price.toLocaleString()}</p>
      </div>

      <Button size="lg" disabled={!ready || !inStock} className="w-full">
        {!ready ? t('selectSize') : !inStock ? t('outOfStock') : t('addToCart')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: `PDP.tsx`**

```tsx
import Image from 'next/image';
import { VariantSelector } from './VariantSelector';
import type { ProductDetailData } from '@/server/queries/products';

export function PDP({ data, locale }: { data: ProductDetailData; locale: 'th' | 'en' }) {
  const name = (data.product.name as { th?: string; en?: string })[locale] ?? data.product.slug;
  const desc = (data.product.description as { th?: string; en?: string })[locale] ?? '';

  return (
    <article className="container mx-auto px-6 py-16">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="space-y-4">
          {data.images.length > 0 ? (
            data.images.map((img) => {
              const altObj = img.alt as { th?: string; en?: string };
              return (
                <Image
                  key={img.id}
                  src={img.url_1600}
                  alt={altObj?.[locale] ?? name}
                  width={1600}
                  height={1600}
                  className="w-full rounded-md bg-paper-warm object-cover"
                />
              );
            })
          ) : (
            <div className="aspect-square w-full rounded-md bg-line" />
          )}
        </div>
        <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <header className="space-y-3">
            <h1 className="font-serif text-4xl text-ink">{name}</h1>
            {desc && <p className="whitespace-pre-line text-ink-soft leading-relaxed">{desc}</p>}
          </header>
          <VariantSelector
            options={data.options}
            variants={data.variants}
            basePriceThb={data.product.base_price_thb}
          />
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: PDP route `src/app/[locale]/product/[slug]/page.tsx`**

```tsx
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PDP } from '@/components/shop/PDP';
import { getProductBySlug } from '@/server/queries/products';
import type { Locale } from '@/i18n/routing';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  return <PDP data={data} locale={locale} />;
}
```

- [ ] **Step 4: Lint + build + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run build 2>&1 | tail -10"
git add . && git commit -m "feat(storefront): PDP route with image stack + variant selector"
```

---

## Task 18: Admin layout + gating + login stub

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/login/page.tsx`, `src/components/admin/AdminNav.tsx`, `src/server/actions/auth.ts`

- [ ] **Step 1: `src/server/actions/auth.ts`**

```ts
'use server';

import { createServerSupabase } from '@/db/client';
import { redirect } from 'next/navigation';

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email required' };
  const supa = await createServerSupabase();
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000'}/admin` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function signOutAdmin() {
  const supa = await createServerSupabase();
  await supa.auth.signOut();
  redirect('/admin/login');
}
```

- [ ] **Step 2: `src/components/admin/AdminNav.tsx`**

```tsx
import Link from 'next/link';
import { signOutAdmin } from '@/server/actions/auth';

export function AdminNav() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/admin" className="font-serif text-lg text-ink">
          admin
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ink-soft">
          <Link href="/admin/products" className="hover:text-ink transition-colors">Products</Link>
          <form action={signOutAdmin}>
            <button type="submit" className="text-muted hover:text-ink transition-colors">Sign out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `src/app/admin/layout.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/db/client';
import { getCurrentRole } from '@/db/auth';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supa = await createServerSupabase();
  const role = await getCurrentRole(supa);

  if (role !== 'owner' && role !== 'dev') {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-paper">
      <AdminNav />
      <main className="container mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
```

(Note: the `/admin/login` page itself needs to bypass this gate. We do that by checking the pathname in the layout. But Next.js layouts can't skip their own children. So we put `/admin/login` OUTSIDE the gated layout by making it its own route group. Cleaner: handle the redirect only when role is missing AND we're not already at login.)

Replace the layout with a path check:

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabase } from '@/db/client';
import { getCurrentRole } from '@/db/auth';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';
  const isLoginPage = pathname.startsWith('/admin/login');

  if (!isLoginPage) {
    const supa = await createServerSupabase();
    const role = await getCurrentRole(supa);
    if (role !== 'owner' && role !== 'dev') {
      redirect('/admin/login');
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      {!isLoginPage && <AdminNav />}
      <main className={isLoginPage ? '' : 'container mx-auto px-6 py-12'}>{children}</main>
    </div>
  );
}
```

And add an x-pathname header in middleware (see updated middleware below).

Update `src/middleware.ts` to forward pathname:

```ts
import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Forward pathname so layouts can read it
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);

  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    return NextResponse.next({ request: { headers } });
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
```

- [ ] **Step 4: `src/app/admin/page.tsx`**

```tsx
import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl text-ink">Welcome.</h1>
      <p className="text-ink-soft">
        Start with <Link href="/admin/products" className="underline">Products</Link>.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: `src/app/admin/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { requestMagicLink } from '@/server/actions/auth';

export default function AdminLoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | { error: string }>('idle');

  return (
    <div className="mx-auto max-w-md py-24 space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">admin</p>
        <h1 className="font-serif text-3xl text-ink">Sign in</h1>
      </header>
      <form
        action={async (fd) => {
          setSubmitting(true);
          const r = await requestMagicLink(fd);
          setSubmitting(false);
          if ('ok' in r) setStatus('sent');
          else setStatus({ error: r.error });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Sending…' : 'Send magic link'}
        </Button>
        {status === 'sent' && (
          <p className="text-sm text-success">Check your inbox (or Mailpit at http://127.0.0.1:54324 for local dev).</p>
        )}
        {typeof status === 'object' && 'error' in status && (
          <p className="text-sm text-error">{status.error}</p>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Build + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run build 2>&1 | tail -12"
git add . && git commit -m "feat(admin): gated layout + magic-link login stub + nav"
```

---

## Task 19: Server actions — product CRUD

**Files:**
- Create: `src/server/actions/products.ts`

- [ ] **Step 1: Implement**

```ts
'use server';

import * as z from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/db/client';
import { requireOwnerOrDev } from '@/db/auth';
import { slugify } from '@/domain/slugify';
import { generateVariants, type VariantAxis } from '@/domain/variant-matrix';

const I18nString = z.object({ th: z.string().default(''), en: z.string().default('') });

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'archived']),
  name: I18nString,
  description: I18nString,
  basePriceThb: z.number().int().nonnegative(),
  weightGrams: z.number().int().nonnegative().default(0),
  category: z.string().nullish(),
  isFeatured: z.boolean().default(false),
  axes: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  variantOverrides: z.array(z.object({ optionValues: z.record(z.string()), priceThb: z.number().int().nullable(), stockAvailable: z.number().int().nonnegative() })),
});

export type ProductInputT = z.infer<typeof ProductInput>;

export async function saveProduct(raw: ProductInputT) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const input = ProductInput.parse(raw);

  const slug = input.slug ?? slugify(input.name.en || input.name.th, { fallback: `product-${Date.now()}` });
  const nameJson = { th: input.name.th, en: input.name.en };
  const descJson = { th: input.description.th, en: input.description.en };

  if (input.id) {
    const { error } = await supa
      .from('products')
      .update({
        slug,
        status: input.status,
        name: nameJson,
        description: descJson,
        base_price_thb: input.basePriceThb,
        weight_grams: input.weightGrams,
        category: input.category ?? null,
        is_featured: input.isFeatured,
      })
      .eq('id', input.id);
    if (error) return { error: error.message };
    await syncVariants(supa, input.id, input.axes, input.variantOverrides);
    revalidatePath('/[locale]', 'page');
    revalidatePath(`/[locale]/product/${slug}`);
    return { ok: true, id: input.id, slug };
  }

  const { data, error } = await supa
    .from('products')
    .insert({
      slug,
      status: input.status,
      name: nameJson,
      description: descJson,
      base_price_thb: input.basePriceThb,
      weight_grams: input.weightGrams,
      category: input.category ?? null,
      is_featured: input.isFeatured,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Insert failed' };

  await syncVariants(supa, data.id, input.axes, input.variantOverrides);
  revalidatePath('/[locale]', 'page');
  return { ok: true, id: data.id, slug };
}

async function syncVariants(
  supa: Awaited<ReturnType<typeof createServerSupabase>>,
  productId: string,
  axes: VariantAxis[],
  overrides: { optionValues: Record<string, string>; priceThb: number | null; stockAvailable: number }[],
) {
  await supa.from('variant_options').delete().eq('product_id', productId);
  if (axes.length === 0) return;

  await supa.from('variant_options').insert(
    axes.map((a, i) => ({
      product_id: productId,
      name: a.name,
      values: [...a.values],
      sort: i,
    })),
  );

  await supa.from('variants').delete().eq('product_id', productId);
  const drafts = generateVariants(axes);
  const rows = drafts.map((d, i) => {
    const ov = overrides.find((o) =>
      Object.entries(d.optionValues).every(([k, v]) => o.optionValues[k] === v),
    );
    return {
      product_id: productId,
      sku: `${productId.slice(0, 8)}-${i}`,
      option_values: d.optionValues,
      price_thb: ov?.priceThb ?? null,
      stock_available: ov?.stockAvailable ?? 0,
      is_active: true,
    };
  });
  if (rows.length > 0) {
    await supa.from('variants').insert(rows);
  }
}

export async function archiveProduct(id: string) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const { error } = await supa.from('products').update({ status: 'archived' }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/[locale]', 'page');
  return { ok: true };
}
```

- [ ] **Step 2: Commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run typecheck"
git add . && git commit -m "feat(server): product server actions — saveProduct + archiveProduct"
```

---

## Task 20: Storage signed upload + `ImagePicker` component

**Files:**
- Create: `src/server/actions/storage.ts`, `src/app/api/storage/sign-upload/route.ts`, `src/components/admin/ImagePicker.tsx`

- [ ] **Step 1: `src/app/api/storage/sign-upload/route.ts`**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/db/client';
import { requireOwnerOrDev, ForbiddenError } from '@/db/auth';

export async function POST(request: NextRequest) {
  try {
    const supa = await createServerSupabase();
    await requireOwnerOrDev(supa);
    const { path } = await request.json();
    if (typeof path !== 'string' || !path.startsWith('products/')) {
      return NextResponse.json({ error: 'Bad path' }, { status: 400 });
    }
    const { data, error } = await supa.storage
      .from('product-images')
      .createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Sign failed' }, { status: 500 });
    }
    return NextResponse.json({ token: data.token, path: data.path });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: `src/components/admin/ImagePicker.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { createBrowserSupabase } from '@/db/client';
import { resizeImageToWebp, IMAGE_SIZES } from '@/lib/images';

interface UploadedImage {
  url_400: string;
  url_800: string;
  url_1600: string;
  storage_path: string;
}

export function ImagePicker({
  productId,
  onUploaded,
}: {
  productId: string;
  onUploaded: (img: UploadedImage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const supa = createBrowserSupabase();
      const stamp = Date.now();
      const urls: Record<number, string> = {};
      let storagePath = '';
      for (const size of IMAGE_SIZES) {
        const blob = await resizeImageToWebp(file, size);
        const path = `products/${productId}/${stamp}-${size}.webp`;
        const signRes = await fetch('/api/storage/sign-upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        if (!signRes.ok) throw new Error('sign-upload failed');
        const { token } = (await signRes.json()) as { token: string };
        const { error: upErr } = await supa.storage
          .from('product-images')
          .uploadToSignedUrl(path, token, blob, { contentType: 'image/webp' });
        if (upErr) throw upErr;
        const { data: pub } = supa.storage.from('product-images').getPublicUrl(path);
        urls[size] = pub.publicUrl;
        if (size === IMAGE_SIZES[0]) storagePath = path;
      }
      onUploaded({
        url_400: urls[400]!,
        url_800: urls[800]!,
        url_1600: urls[1600]!,
        storage_path: storagePath,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="image-upload">Add image</Label>
      <input
        id="image-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-paper hover:file:bg-ink-soft"
      />
      {busy && <p className="text-sm text-muted">Resizing and uploading…</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run typecheck"
git add . && git commit -m "feat(admin): image upload pipeline — signed URL endpoint + client picker w/ 3-size resize"
```

---

## Task 21: Admin pages — products list, new, edit

**Files:**
- Create: `src/app/admin/products/page.tsx`, `src/app/admin/products/new/page.tsx`, `src/app/admin/products/[id]/edit/page.tsx`, `src/components/admin/ProductForm.tsx`

- [ ] **Step 1: `src/components/admin/ProductForm.tsx`** (large — full form)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { ImagePicker } from './ImagePicker';
import { saveProduct, type ProductInputT } from '@/server/actions/products';
import { createBrowserSupabase } from '@/db/client';

type Axis = { name: string; values: string[] };

export function ProductForm({
  initial,
}: {
  initial: Partial<ProductInputT> & { id?: string; imageRows?: { id: string; url_400: string }[] };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ProductInputT>({
    id: initial.id,
    slug: initial.slug,
    status: initial.status ?? 'draft',
    name: initial.name ?? { th: '', en: '' },
    description: initial.description ?? { th: '', en: '' },
    basePriceThb: initial.basePriceThb ?? 0,
    weightGrams: initial.weightGrams ?? 0,
    category: initial.category ?? '',
    isFeatured: initial.isFeatured ?? false,
    axes: initial.axes ?? [
      { name: 'size', values: ['S', 'M', 'L', 'XL'] },
      { name: 'color', values: ['cream'] },
    ],
    variantOverrides: initial.variantOverrides ?? [],
  });
  const [images, setImages] = useState(initial.imageRows ?? []);

  function updateAxis(idx: number, patch: Partial<Axis>) {
    setState((s) => ({
      ...s,
      axes: s.axes.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await saveProduct(state);
    setBusy(false);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    router.push(`/admin/products`);
    router.refresh();
  }

  async function attachImage(productId: string, img: { url_400: string; url_800: string; url_1600: string; storage_path: string }) {
    const supa = createBrowserSupabase();
    const { data, error: insErr } = await supa
      .from('product_images')
      .insert({
        product_id: productId,
        sort: images.length,
        storage_path: img.storage_path,
        url_400: img.url_400,
        url_800: img.url_800,
        url_1600: img.url_1600,
        alt: {},
      })
      .select('id, url_400')
      .single();
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setImages((prev) => [...prev, data]);
    if (images.length === 0) {
      await supa.from('products').update({ hero_image_id: data.id }).eq('id', productId);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10 max-w-3xl">
      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-ink">Basics</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name (TH)</Label>
            <Input
              value={state.name.th}
              onChange={(e) => setState({ ...state, name: { ...state.name, th: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label>Name (EN)</Label>
            <Input
              value={state.name.en}
              onChange={(e) => setState({ ...state, name: { ...state.name, en: e.target.value } })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Description (TH)</Label>
            <Textarea
              value={state.description.th}
              onChange={(e) =>
                setState({ ...state, description: { ...state.description, th: e.target.value } })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Description (EN)</Label>
            <Textarea
              value={state.description.en}
              onChange={(e) =>
                setState({ ...state, description: { ...state.description, en: e.target.value } })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Base price (THB)</Label>
            <Input
              type="number"
              min={0}
              value={state.basePriceThb}
              onChange={(e) => setState({ ...state, basePriceThb: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Weight (g)</Label>
            <Input
              type="number"
              min={0}
              value={state.weightGrams}
              onChange={(e) => setState({ ...state, weightGrams: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={state.status}
              onChange={(e) =>
                setState({ ...state, status: e.target.value as ProductInputT['status'] })
              }
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isFeatured"
            type="checkbox"
            checked={state.isFeatured}
            onChange={(e) => setState({ ...state, isFeatured: e.target.checked })}
          />
          <Label htmlFor="isFeatured">Feature on landing</Label>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-ink">Variants</h2>
        {state.axes.map((axis, i) => (
          <div key={axis.name} className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Axis name</Label>
              <Input
                value={axis.name}
                onChange={(e) => updateAxis(i, { name: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Values (comma separated)</Label>
              <Input
                value={axis.values.join(', ')}
                onChange={(e) =>
                  updateAxis(i, {
                    values: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </div>
          </div>
        ))}
      </section>

      {state.id && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-ink">Images</h2>
          <div className="grid grid-cols-4 gap-3">
            {images.map((img) => (
              <img key={img.id} src={img.url_400} alt="" className="aspect-square w-full rounded object-cover" />
            ))}
          </div>
          <ImagePicker
            productId={state.id}
            onUploaded={(img) => state.id && attachImage(state.id, img)}
          />
        </section>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : state.id ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: `src/app/admin/products/page.tsx`** (list)

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createServerSupabase } from '@/db/client';

export default async function AdminProductsPage() {
  const supa = await createServerSupabase();
  const { data: products } = await supa
    .from('products')
    .select('id, slug, status, name, base_price_thb, is_featured, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink">Products</h1>
        <Link href="/admin/products/new"><Button>New product</Button></Link>
      </div>

      <div className="rounded-lg border border-line bg-paper">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Featured</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => {
              const name = (p.name as { en?: string; th?: string }).en ?? (p.name as { th?: string }).th ?? p.slug;
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{name}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.status}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.is_featured ? '✓' : ''}</td>
                  <td className="px-4 py-3 text-ink-soft">฿{p.base_price_thb.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/products/${p.id}/edit`} className="text-rose-deep hover:underline">Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/admin/products/new/page.tsx`**

```tsx
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">New product</h1>
      <ProductForm initial={{}} />
    </div>
  );
}
```

- [ ] **Step 4: `src/app/admin/products/[id]/edit/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/db/client';
import { ProductForm } from '@/components/admin/ProductForm';
import type { ProductInputT } from '@/server/actions/products';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = await createServerSupabase();
  const [{ data: product }, { data: axes }, { data: images }] = await Promise.all([
    supa.from('products').select('*').eq('id', id).maybeSingle(),
    supa.from('variant_options').select('name, values, sort').eq('product_id', id).order('sort'),
    supa.from('product_images').select('id, url_400').eq('product_id', id).order('sort'),
  ]);
  if (!product) notFound();

  const initial: Partial<ProductInputT> & { id: string; imageRows: { id: string; url_400: string }[] } = {
    id: product.id,
    slug: product.slug,
    status: product.status,
    name: product.name as ProductInputT['name'],
    description: product.description as ProductInputT['description'],
    basePriceThb: product.base_price_thb,
    weightGrams: product.weight_grams,
    category: product.category ?? '',
    isFeatured: product.is_featured,
    axes: (axes ?? []).map((a) => ({ name: a.name, values: a.values })),
    variantOverrides: [],
    imageRows: images ?? [],
  };

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">Edit product</h1>
      <ProductForm initial={initial} />
    </div>
  );
}
```

- [ ] **Step 5: Build + commit**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint:fix && ~/.bun/bin/bun run build 2>&1 | tail -15"
git add . && git commit -m "feat(admin): products list + create + edit pages"
```

---

## Task 22: Final gate + smoke walkthrough

**Files:** none new.

- [ ] **Step 1: Full local gate**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run lint && ~/.bun/bin/bun run typecheck && ~/.bun/bin/bun run test && ~/.bun/bin/bun run build 2>&1 | tail -10"
```
Expected: all four green; 53+ tests (added: slugify 7, variant-matrix 4, images 4).

- [ ] **Step 2: Manual smoke walkthrough** (user-driven)

1. `bun run dev` → open http://localhost:3000 → redirects to `/th`.
2. See landing hero "ทำอย่างใส่ใจ / ส่งอย่างอบอุ่น". No featured products yet (empty grid hidden).
3. Click `EN` → URL becomes `/en` → hero shows "made slowly, / shipped warmly".
4. Click `shop` → `/en/shop` → "nothing in the shop right now".
5. Navigate to `/admin` → redirect to `/admin/login`.
6. Enter your dev email → check Mailpit (http://127.0.0.1:54324) → click magic link.
7. After login, you land in `/admin`. Click `Products`.
8. Click `New product`, fill name TH/EN ("เสื้อยืดฤดูร้อน" / "Summer Tee"), base price 590, weight 200, status Active, check "Feature on landing", Save.
9. Edit the product → upload an image → variants are generated.
10. Visit `/th/shop` → product appears. Click → PDP shows. Variant selector works.
11. Visit `/th` → landing now shows featured product.

- [ ] **Step 3: Commit any housekeeping**

```bash
git add . && git commit -m "chore(plan2): foundation green-CI checkpoint" || true
```

---

## Out of scope for Plan 2 (handled in later plans)

| Concern | Plan |
|---|---|
| Cart + checkout (mock payment) + order schema + receipts + shipping timeline | Plan 3 |
| Admin orders + waitlist + discount codes + email + cron | Plan 4 |
| Google Sheets sync + dev-only screens (role mgmt, audit) | Plan 5 |
| Motion + security headers + E2E (Playwright) + production deploy | Plan 6 |

---

## Self-review notes

- **Spec coverage:** Plan 2 implements §4 schema (products, variants, variant_options, product_images), §6.4 (admin add product flow), §7 aesthetic (Soft Studio palette in all UI), §1 success criterion ("creator can add a product in under 5 minutes").
- **No placeholders.** Every step has concrete commands or code.
- **TDD where it adds value:** slugify, variant-matrix, images (pure functions). Server actions + components are integration-tested by the smoke walkthrough; full E2E coverage comes in Plan 6 (per spec rollout).
- **Grants invariant:** every catalog table migration explicitly grants `service_role` (Plan 1 task 14 lesson baked in).
- **No npm packages introduced beyond Bun-installed:** `next-intl`, `nanoid` (actually not used — removed), `server-only`. No shadcn CLI dependency — primitives are hand-rolled.
- **Decisions locked at top of plan:** TH default, hero+featured-grid landing, client-side resize. No silent assumptions.
- **Commit per task** continues on `develop`.
