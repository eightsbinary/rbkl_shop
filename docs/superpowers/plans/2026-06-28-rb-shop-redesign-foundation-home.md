# Redesign Phase 1 — Editorial Mono foundation + Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the storefront foundation (tokens, fonts, shared chrome) to the Editorial Mono direction and rebuild the Home page with the Figma's asymmetric bento, faithfully, using real products and TH/EN.

**Architecture:** Tailwind v4 `@theme` token remap (mono; existing token *names* kept and revalued so the other 21 files don't break) + `Libre Caslon Text` display serif. Shared `Header`/`Footer`/`Button`/`ProductCard` restyled in place; three new presentational components (`Hero`, `FeaturedBento`, `NewsletterBand`) compose the new Home. No logic/data-flow changes beyond adding `category` to the product-card query.

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4 (`@theme`), `next/font/google`, Supabase queries (server). Bun for everything except `next build` (Node). Local Supabase stack must be up for visual checks.

**Reference:** Spec [docs/superpowers/specs/2026-06-28-rb-shop-redesign-foundation-home-design.md](../specs/2026-06-28-rb-shop-redesign-foundation-home-design.md). Figma screenshot of Home saved at `C:\Users\ton\AppData\Local\Temp\claude\--wsl-localhost-Ubuntu-home-ton-workspace-rb-shop\c8dfd812-bed8-41dc-9d62-b51eb971eb90\scratchpad\home-shop.png` (re-fetch from Figma node `0:275` if expired).

---

## Conventions (carry-over)

Branch `develop`, commit per task. Run WSL commands via helper scripts (PATH-paren quirk): `/tmp/p6a2-check.sh <files>` = tsc + biome; `next build` = `~/.local/bin/node ./node_modules/next/dist/bin/next build`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. These are **presentational** changes — verification is tsc + biome + build green + a visual compare against the Figma screenshot; no new unit tests (existing suite must stay green: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh"`).

## File structure

```
src/app/globals.css                      (modify — Editorial Mono @theme tokens)
src/app/layout.tsx                       (modify — Libre Caslon Text font)
src/components/ui/Button.tsx             (modify — outline/solid variants; repoint secondary)
src/components/shop/Header.tsx           (modify — editorial TopNav)
src/components/shop/Footer.tsx           (modify — editorial footer)
src/server/queries/products.ts          (modify — add `category` to ProductCardData + queries)
src/components/shop/ProductCard.tsx      (modify — editorial card + subtitle)
src/components/shop/FeaturedBento.tsx    (new — 4-slot asymmetric grid)
src/components/shop/Hero.tsx             (new — full-bleed hero)
src/components/shop/NewsletterBand.tsx   (new — dark stub band)
src/app/[locale]/page.tsx               (modify — compose the new Home)
messages/en.json, messages/th.json       (modify — new storefront strings)
```

---

## Task 1: Editorial Mono tokens + Libre Caslon Text

**Files:** Modify `src/app/globals.css`, `src/app/layout.tsx`.

- [ ] **Step 1: Remap the `@theme` palette.** In `src/app/globals.css`, replace the entire `@theme { ... }` block with:

```css
@theme {
  /* Editorial Mono — neutral monochrome (token names kept for back-compat; rose* + paper-warm
     revalued to neutrals so the ~21 not-yet-restyled files degrade gracefully to mono). */
  --color-ink: #111111;
  --color-ink-soft: #3a3a3a;
  --color-ink-deep: #1a1a1a; /* dark bands (Journal / hero overlay); text on it = paper */
  --color-paper: #fbfbfa;
  --color-surface: #ffffff; /* cards / PDP panels */
  --color-field: #f3f3f4; /* image placeholder fields */
  --color-paper-warm: #f3f3f4; /* back-compat alias → field */
  --color-muted: #5e5e5e;
  --color-line: #e2e2e2;
  /* rose accent retired → neutralised (existing rose-* classes now render mono) */
  --color-rose: #111111;
  --color-rose-deep: #000000;
  --color-rose-soft: #e2e2e2;
  --color-success: #4a6b56;
  --color-warn: #8a6a3d;
  --color-error: #a83e40;

  --font-serif: var(--font-caslon), var(--font-plex-thai), ui-serif, Georgia, serif;
  --font-sans: var(--font-inter), var(--font-plex-thai), ui-sans-serif, system-ui, sans-serif;

  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.45, 0.6, 1);
}
```

- [ ] **Step 2: Neutralise `::selection`.** In the same file, change the `::selection` rule background from `var(--color-rose-soft)` to `var(--color-line)` (keep `color: var(--color-ink)`).

- [ ] **Step 3: Swap the display serif to Libre Caslon Text.** In `src/app/layout.tsx`, replace the `Fraunces` import + const with `Libre_Caslon_Text`. The import line becomes:

```ts
import { IBM_Plex_Sans_Thai, Inter, Libre_Caslon_Text } from 'next/font/google';
```

Replace the `fraunces` const with:

```ts
const caslon = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-caslon',
  display: 'swap',
});
```

And in the `<html>` className, replace `${fraunces.variable}` with `${caslon.variable}` (keep `${inter.variable} ${plexThai.variable}`).

- [ ] **Step 4: Typecheck + lint + build.**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/app/globals.css src/app/layout.tsx"` → TSC_OK, biome clean.
Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3"` → `Compiled successfully`.

- [ ] **Step 5: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/app/globals.css src/app/layout.tsx
git commit -m "$(printf 'feat(design): Editorial Mono tokens + Libre Caslon Text\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Button — editorial outline/solid variants

**Files:** Modify `src/components/ui/Button.tsx`.

The store's editorial CTAs are square, uppercase, letter-spaced (outline: hairline ink border, hover fills ink; solid: ink fill). Existing `primary`/`secondary`/`ghost` stay (admin uses them) — just repoint `secondary` off the retired `paper-warm` look to neutral surface.

- [ ] **Step 1: Replace the variant table + add a Variant.** In `src/components/ui/Button.tsx`, change:

```ts
type Variant = 'primary' | 'secondary' | 'ghost';
```
to
```ts
type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'solid';
```

and replace `variantClasses` with:

```ts
const variantClasses: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  secondary: 'bg-surface text-ink border border-line hover:bg-field',
  ghost: 'bg-transparent text-ink hover:bg-field',
  // Editorial CTAs — square, uppercase, tracked
  outline:
    'rounded-none border border-ink bg-transparent text-ink uppercase tracking-[0.12em] hover:bg-ink hover:text-paper',
  solid: 'rounded-none bg-ink text-paper uppercase tracking-[0.12em] hover:bg-ink-soft',
};
```

- [ ] **Step 2: Typecheck + lint.** Run `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/ui/Button.tsx"` → TSC_OK, biome clean.

- [ ] **Step 3: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/ui/Button.tsx
git commit -m "$(printf 'feat(design): editorial outline/solid Button variants\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Header — editorial TopNav

**Files:** Modify `src/components/shop/Header.tsx`.

Centered serif wordmark, left nav (SHOP), right cart + locale switch, bottom hairline, taller (80px). (ABOUT link is added in Phase 4 with the About page — omit now to avoid a dead link.)

- [ ] **Step 1: Replace the component body** with:

```tsx
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartIcon } from '@/components/cart/CartIcon';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Header() {
  const locale = useLocale();
  const t = useTranslations('nav');
  return (
    <header className="border-b border-line bg-paper">
      <div className="container mx-auto grid h-20 grid-cols-[1fr_auto_1fr] items-center px-6">
        <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <Link href={`/${locale}/shop`} className="transition-colors hover:text-ink">
            {t('shop')}
          </Link>
        </nav>
        <Link
          href={`/${locale}`}
          className="justify-self-center font-serif text-2xl tracking-tight text-ink"
        >
          rainbykello
        </Link>
        <div className="flex items-center justify-end gap-5 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <CartIcon label={t('cart')} />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck + lint.** Run `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/Header.tsx"` → clean. (If `CartIcon`/`LocaleSwitcher` props differ, read those files and keep their existing prop usage — only the layout/classes change.)

- [ ] **Step 3: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/Header.tsx
git commit -m "$(printf 'feat(design): editorial centered-wordmark TopNav\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Footer — editorial

**Files:** Modify `src/components/shop/Footer.tsx`.

Top hairline, brand wordmark + © left, real rainbykello socials right (kept), generous padding. Mono.

- [ ] **Step 1: Replace the component body** with:

```tsx
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer className="border-t border-line bg-paper">
      <div className="container mx-auto flex flex-col gap-8 px-6 py-16 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p className="font-serif text-xl text-ink">rainbykello</p>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            {t('copyright')} {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <a
            href="https://www.instagram.com/rainbykello/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-ink"
          >
            Instagram
          </a>
          <a
            href="https://www.twitch.tv/rainbykello"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-ink"
          >
            Twitch
          </a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/Footer.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/Footer.tsx
git commit -m "$(printf 'feat(design): editorial footer\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Add `category` to the product-card query

**Files:** Modify `src/server/queries/products.ts`.

The bento card subtitle (e.g. "Heavyweight French Terry") maps from the product `category` column, which isn't currently selected.

- [ ] **Step 1: Extend the type + mapper.** In `src/server/queries/products.ts`:
  1. Add `category: string | null;` to the `ProductCardData` interface (after `basePriceThb`).
  2. In `rowToCard`, add `category` to the input object type (`category: unknown`) and to the returned object: `category: (p.category as string | null) ?? null,`.
  3. In BOTH `listActiveProducts` and `listFeaturedProducts`, add `category` to the `.select('id, slug, name, base_price_thb, category, hero_image:...')` string.

- [ ] **Step 2: Typecheck.** Run `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/queries/products.ts"` → TSC_OK. (`category` exists on the `products` row type, so the select typechecks.)

- [ ] **Step 3: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/queries/products.ts
git commit -m "$(printf 'feat(shop): expose product category for card subtitle\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: ProductCard — editorial

**Files:** Modify `src/components/shop/ProductCard.tsx`.

Image in a `field` frame (no rounded/shadow), then a row: left = serif name (24/32) + muted subtitle, right = price. Subtitle = `category` (fallback: hidden).

- [ ] **Step 1: Replace the component body** with:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import type { ProductCardData } from '@/server/queries/products';

export function ProductCard({
  product,
  locale,
  imageClassName = 'aspect-square',
}: {
  product: ProductCardData;
  locale: 'th' | 'en';
  imageClassName?: string;
}) {
  const name = product.name[locale] ?? product.name.en ?? product.name.th ?? product.slug;
  const altObj = product.heroImage?.alt as { th?: string; en?: string } | undefined;
  const alt = altObj?.[locale] ?? altObj?.en ?? name;

  return (
    <Link href={`/${locale}/product/${product.slug}`} className="group block space-y-4">
      <div className={`overflow-hidden bg-field ${imageClassName}`}>
        {product.heroImage ? (
          <Image
            src={product.heroImage.url_800}
            alt={alt}
            width={800}
            height={800}
            className="h-full w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-field" />
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-serif text-2xl leading-8 text-ink">{name}</p>
          {product.category && <p className="text-base text-muted">{product.category}</p>}
        </div>
        <p className="shrink-0 text-base text-ink">฿{product.basePriceThb.toLocaleString()}</p>
      </div>
    </Link>
  );
}
```

(The `imageClassName` prop lets the bento control each slot's image height while the uniform grid keeps `aspect-square` by default.)

- [ ] **Step 2: Typecheck + lint.** Run `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/ProductCard.tsx"` → clean. (`ProductGrid` calls `<ProductCard product locale />` — the new optional prop is back-compatible.)

- [ ] **Step 3: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/ProductCard.tsx
git commit -m "$(printf 'feat(design): editorial product card\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: FeaturedBento component

**Files:** Create `src/components/shop/FeaturedBento.tsx`.

The Figma's asymmetric 12-col, 2-row grid (gap 24px): A `col-[1/span_8] row-1` (image 570), B `col-[9/span_4] row-1` (image 368, caption lower), C `col-[1/span_4] row-2` (image 490), D `col-[5/span_8] row-2` (image 326). Renders up to 4 products into A–D; fewer than 4 → render only the filled slots in order.

- [ ] **Step 1: Create the component.**

```tsx
import type { ProductCardData } from '@/server/queries/products';
import { ProductCard } from './ProductCard';

/** Slot geometry from the Figma "Bento Grid Layout" (node 0:306): 12 cols, 24px gaps,
 *  two rows. Each slot fixes its image height to recreate the asymmetric rhythm. */
const SLOTS = [
  { col: 'lg:col-[1/span_8] lg:row-1', img: 'h-[420px] lg:h-[570px]' },
  { col: 'lg:col-[9/span_4] lg:row-1 lg:self-end', img: 'h-[300px] lg:h-[368px]' },
  { col: 'lg:col-[1/span_4] lg:row-2', img: 'h-[360px] lg:h-[490px]' },
  { col: 'lg:col-[5/span_8] lg:row-2', img: 'h-[280px] lg:h-[326px]' },
] as const;

export function FeaturedBento({
  products,
  locale,
}: {
  products: ProductCardData[];
  locale: 'th' | 'en';
}) {
  const items = products.slice(0, 4);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
      {items.map((p, i) => (
        <div key={p.id} className={SLOTS[i]?.col ?? ''}>
          <ProductCard product={p} locale={locale} imageClassName={SLOTS[i]?.img} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/FeaturedBento.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/FeaturedBento.tsx
git commit -m "$(printf 'feat(design): asymmetric featured bento grid\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: Hero + NewsletterBand

**Files:** Create `src/components/shop/Hero.tsx`, `src/components/shop/NewsletterBand.tsx`.

- [ ] **Step 1: Create `Hero.tsx`.** Full-bleed image (uses the top featured product's hero image, else a `field` block), dark overlay, centered serif headline + subtext + outline CTA to `/shop`.

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function Hero({
  locale,
  title,
  subtitle,
  cta,
  imageUrl,
  imageAlt,
}: {
  locale: 'th' | 'en';
  title: string;
  subtitle: string;
  cta: string;
  imageUrl: string | null;
  imageAlt: string;
}) {
  return (
    <section className="relative h-[70vh] min-h-[480px] w-full overflow-hidden bg-ink-deep">
      {imageUrl && (
        <Image src={imageUrl} alt={imageAlt} fill priority className="object-cover" sizes="100vw" />
      )}
      <div className="absolute inset-0 bg-ink-deep/35" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-6 text-center text-paper">
        <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-6xl">{title}</h1>
        <p className="max-w-md text-sm text-paper/80">{subtitle}</p>
        <Link href={`/${locale}/shop`}>
          <Button variant="outline" size="md" className="border-paper text-paper hover:bg-paper hover:text-ink">
            {cta}
          </Button>
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `NewsletterBand.tsx`** (dark stub — the form does not submit anywhere yet).

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/** Editorial "Journal" band. Phase 1 stub: captures the email locally and shows a
 *  thank-you; no backend wiring yet (no newsletter service exists). */
export function NewsletterBand({
  title,
  subtitle,
  placeholder,
  cta,
  thanks,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  cta: string;
  thanks: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <section className="bg-ink-deep px-6 py-24 text-center text-paper">
      <div className="mx-auto max-w-xl space-y-5">
        <h2 className="font-serif text-3xl">{title}</h2>
        <p className="text-sm text-paper/70">{subtitle}</p>
        {done ? (
          <p className="text-sm text-paper/90">{thanks}</p>
        ) : (
          <form
            className="flex items-center justify-center gap-0"
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true); // TODO(newsletter-backend): POST to a real list when one exists.
            }}
          >
            <input
              type="email"
              required
              placeholder={placeholder}
              className="h-12 w-64 border border-paper/30 bg-transparent px-4 text-sm text-paper placeholder:text-paper/40 focus:border-paper focus:outline-none"
            />
            <Button type="submit" variant="solid" size="md" className="border border-paper bg-paper text-ink hover:bg-paper/90">
              {cta}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/Hero.tsx src/components/shop/NewsletterBand.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/Hero.tsx src/components/shop/NewsletterBand.tsx
git commit -m "$(printf 'feat(design): editorial hero + newsletter band (stub)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 9: Compose the Home page + i18n strings

**Files:** Modify `src/app/[locale]/page.tsx`, `messages/en.json`, `messages/th.json`.

- [ ] **Step 1: Add strings to `messages/en.json`** — extend the existing `"landing"` object to:

```json
"landing": {
  "heroLine1": "made slowly,",
  "heroLine2": "shipped warmly",
  "heroSubtitle": "Merchandise made slowly and shipped warmly, from rainbykello.",
  "heroCta": "Explore new arrivals",
  "featuredTitle": "Curated Pieces",
  "viewAll": "view all",
  "viewCollection": "View entire collection",
  "journalTitle": "The Studio Journal",
  "journalSubtitle": "Sign up for infrequent dispatches on new arrivals, restocks, and studio process. No noise, just warmth.",
  "journalPlaceholder": "Email address",
  "journalCta": "Subscribe",
  "journalThanks": "Thanks — you're on the list."
}
```

- [ ] **Step 2: Add the same keys to `messages/th.json`** — extend its `"landing"` object with Thai values:

```json
"landing": {
  "heroLine1": "ทำอย่างใส่ใจ",
  "heroLine2": "ส่งด้วยความอบอุ่น",
  "heroSubtitle": "สินค้าที่ทำอย่างพิถีพิถันและจัดส่งด้วยความอบอุ่น จาก rainbykello",
  "heroCta": "ดูสินค้ามาใหม่",
  "featuredTitle": "ชิ้นงานคัดสรร",
  "viewAll": "ดูทั้งหมด",
  "viewCollection": "ดูคอลเลกชันทั้งหมด",
  "journalTitle": "สตูดิโอ เจอร์นัล",
  "journalSubtitle": "สมัครรับข่าวสารสินค้ามาใหม่ การเติมสต็อก และเบื้องหลังงานสตูดิโอ",
  "journalPlaceholder": "อีเมล",
  "journalCta": "สมัคร",
  "journalThanks": "ขอบคุณ — คุณอยู่ในรายชื่อแล้ว"
}
```

(Preserve any existing keys in each `landing` object; merge, don't drop. If `th.json` has different existing values for `heroLine1/2`, keep them and only add the new keys.)

- [ ] **Step 3: Rewrite `src/app/[locale]/page.tsx`** to compose the new Home:

```tsx
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeaturedBento } from '@/components/shop/FeaturedBento';
import { Hero } from '@/components/shop/Hero';
import { NewsletterBand } from '@/components/shop/NewsletterBand';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/routing';
import { listFeaturedProducts } from '@/server/queries/products';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const featured = await listFeaturedProducts(4);

  const heroImg = featured[0]?.heroImage?.url_1600 ?? featured[0]?.heroImage?.url_800 ?? null;
  const heroName = featured[0]?.name[locale] ?? featured[0]?.name.en ?? '';

  return (
    <>
      <Hero
        locale={locale}
        title={`${t('heroLine1')} ${t('heroLine2')}`}
        subtitle={t('heroSubtitle')}
        cta={t('heroCta')}
        imageUrl={heroImg}
        imageAlt={heroName}
      />

      {featured.length > 0 && (
        <section className="container mx-auto space-y-16 px-6 py-24 lg:px-16">
          <div className="flex items-end justify-between border-b border-line pb-4">
            <h2 className="font-serif text-3xl text-ink">{t('featuredTitle')}</h2>
            <Link
              href={`/${locale}/shop`}
              className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
            >
              {t('viewAll')}
            </Link>
          </div>

          <FeaturedBento products={featured} locale={locale} />

          <div className="flex justify-center">
            <Link href={`/${locale}/shop`}>
              <Button variant="outline" size="md">
                {t('viewCollection')}
              </Button>
            </Link>
          </div>
        </section>
      )}

      <NewsletterBand
        title={t('journalTitle')}
        subtitle={t('journalSubtitle')}
        placeholder={t('journalPlaceholder')}
        cta={t('journalCta')}
        thanks={t('journalThanks')}
      />
    </>
  );
}
```

- [ ] **Step 4: Validate i18n JSON + typecheck + build.**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"` → both OK.
Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/app/[locale]/page.tsx"` → TSC_OK, biome clean.
Run the build (see Task 1 Step 4) → `Compiled successfully`.

- [ ] **Step 5: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/[locale]/page.tsx" messages/en.json messages/th.json
git commit -m "$(printf 'feat(design): compose Editorial Mono Home (hero, bento, journal)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 10: Visual gate

**Files:** none (verification).

- [ ] **Step 1: Full gate.** Run `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` → typecheck clean, biome clean, all tests pass, `Compiled successfully`.

- [ ] **Step 2: Visual compare.** Ensure the local Supabase stack is up and a seeded active product exists (the `demo-tee` seed, or create products in `/admin`). Start the app (`bun run dev` for a quick look, or the prod build) and load `http://localhost:3000/en`:
  - Hero: full-bleed image, serif headline, outline CTA over a dark overlay.
  - "Curated Pieces" header with hairline; bento renders the featured products in the `[8|4]` / `[4|8]` rhythm at ≥1024px and stacks to one column below.
  - Cards: `field` image frame, Caslon name, muted subtitle (category), price right-aligned.
  - Dark "Studio Journal" band with email + Subscribe.
  - Header: centered `rainbykello` wordmark, SHOP left, cart + locale right, bottom hairline. Footer: brand + © + Instagram/Twitch.
  - Switch to `/th` → Thai renders in IBM Plex Sans Thai; strings translated.
  Compare against the Figma screenshot (`scratchpad/home-shop.png`). Note any drift; fix obvious gaps, otherwise report differences for review.

- [ ] **Step 3 (if any fixes):** commit with `fix(design): …`.

---

## Out of scope (later phases)

| Item | Phase |
|---|---|
| PDP restyle | 2 |
| Cart restyle | 3 |
| About page (+ ABOUT nav link) | 4 |
| Category filter wiring on Home | later |
| Newsletter backend | later |
| Admin Thai i18n | separate plan |
