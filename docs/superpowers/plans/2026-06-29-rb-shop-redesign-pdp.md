# Redesign Phase 2 — Editorial Mono PDP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Product Detail page to the Editorial Mono Figma — image column (large main + 2 detail images) left, a client `BuyPanel` (breadcrumbs, Caslon title, variant-aware price, bordered description, square size buttons, full-width ADD TO CART, Details/Shipping accordions) right — preserving variant selection, pricing, add-to-cart, and sold-out→waitlist.

**Architecture:** A new client `BuyPanel` absorbs `VariantSelector`'s selection/price/stock logic and renders the whole right column; a small native-`<details>` `Accordion`; `PDP.tsx` becomes a 12-col image/panel split; `AddToCartButton`/`WaitlistButton` restyled (behavior unchanged). `VariantSelector.tsx` deleted (no other consumers).

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4 tokens (Phase-1 Editorial Mono), Zustand cart store. Bun except `next build` (Node). Local Supabase up for the visual gate.

**Reference:** Spec [docs/superpowers/specs/2026-06-29-rb-shop-redesign-pdp-design.md](../specs/2026-06-29-rb-shop-redesign-pdp-design.md). Figma PDP screenshot at `scratchpad/product-detail.png` (re-fetch node `0:195` if expired).

---

## Conventions (carry-over)

Branch `develop`, commit per task. Helper `/tmp/p6a2-check.sh <files>` = tsc + biome; `next build` = `~/.local/bin/node ./node_modules/next/dist/bin/next build`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Presentational — no new unit tests; existing suite stays green (135). The target file `src/app/[locale]/product/[slug]/page.tsx` has brackets — quote it in shell.

## File structure

```
messages/en.json, messages/th.json        (modify — pdp.breadcrumbHome, detailsTitle/Body, shippingTitle/Body)
src/components/cart/AddToCartButton.tsx    (modify — solid editorial variant)
src/components/shop/WaitlistButton.tsx     (modify — editorial full-width restyle)
src/components/shop/Accordion.tsx          (new — <details>/<summary> row)
src/components/shop/BuyPanel.tsx           (new, client — whole right column)
src/components/shop/PDP.tsx                (modify — 12-col image/panel split)
src/components/shop/VariantSelector.tsx    (delete — logic folded into BuyPanel)
```

---

## Task 1: PDP i18n strings

**Files:** Modify `messages/en.json`, `messages/th.json`.

The PDP already has `pdp.{size,color,added,selectSize,outOfStock,addToCart,notifyDone,notifyMe,notifyError,notifyEmailPlaceholder}`. Add 5 keys for the breadcrumb + accordions.

- [ ] **Step 1: en.json** — merge into the existing `"pdp"` object (keep existing keys):

```json
"breadcrumbHome": "Home",
"detailsTitle": "Details & Care",
"detailsBody": "Made in small batches and shipped from Thailand. Follow the care label; wash cold, hang dry. Slight variation between pieces is part of how they're made.",
"shippingTitle": "Shipping & Returns",
"shippingBody": "Ships within 3–5 business days. Domestic and international tracked shipping at checkout. Unworn items can be returned within 14 days of delivery."
```

- [ ] **Step 2: th.json** — merge into its `"pdp"` object (keep existing keys):

```json
"breadcrumbHome": "หน้าแรก",
"detailsTitle": "รายละเอียดและการดูแล",
"detailsBody": "ผลิตเป็นล็อตเล็กและจัดส่งจากประเทศไทย โปรดดูป้ายการดูแล ซักด้วยน้ำเย็นและผึ่งให้แห้ง ความแตกต่างเล็กน้อยของแต่ละชิ้นเป็นเสน่ห์ของงานทำมือ",
"shippingTitle": "การจัดส่งและการคืนสินค้า",
"shippingBody": "จัดส่งภายใน 3–5 วันทำการ มีบริการจัดส่งแบบมีเลขติดตามทั้งในและต่างประเทศ สินค้าที่ยังไม่ได้ใช้งานสามารถคืนได้ภายใน 14 วันหลังได้รับสินค้า"
```

- [ ] **Step 3: Validate + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add messages/en.json messages/th.json
git commit -m "$(printf 'feat(i18n): PDP breadcrumb + accordion strings\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Restyle Add-to-Cart + Waitlist buttons

**Files:** Modify `src/components/cart/AddToCartButton.tsx`, `src/components/shop/WaitlistButton.tsx`.

- [ ] **Step 1: AddToCartButton — solid editorial variant.** In `src/components/cart/AddToCartButton.tsx`, change the `<Button ...>` opening tag from:

```tsx
    <Button
      size="lg"
      className="w-full"
      disabled={disabled}
```

to:

```tsx
    <Button
      variant="solid"
      size="lg"
      className="w-full"
      disabled={disabled}
```

(Everything else unchanged — the `solid` variant gives the full-width black uppercase CTA.)

- [ ] **Step 2: WaitlistButton — editorial full-width restyle.** In `src/components/shop/WaitlistButton.tsx`, replace the `if (state === 'done')` block and the returned `<form>` with:

```tsx
  if (state === 'done') {
    return (
      <p className="border border-line bg-field px-4 py-3 text-sm text-ink-soft">{t('notifyDone')}</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted">{t('outOfStock')}</p>
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('notifyEmailPlaceholder')}
        aria-label={t('notifyEmailPlaceholder')}
      />
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={state === 'pending' || !variantId}
      >
        {t('notifyMe')}
      </Button>
      <TurnstileWidget onToken={setToken} />
      {state === 'error' && <p className="text-sm text-error">{t('notifyError')}</p>}
    </form>
  );
```

(Keep all imports + state + `onSubmit` unchanged.)

- [ ] **Step 3: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/cart/AddToCartButton.tsx src/components/shop/WaitlistButton.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/cart/AddToCartButton.tsx src/components/shop/WaitlistButton.tsx
git commit -m "$(printf 'feat(design): editorial add-to-cart + waitlist buttons\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Accordion component

**Files:** Create `src/components/shop/Accordion.tsx`.

- [ ] **Step 1: Create it** (native `<details>`, no JS, chevron rotates on open):

```tsx
export function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm uppercase tracking-[0.14em] text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          className="h-3 w-3 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 12 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M1 1.5 6 6.5 11 1.5" />
        </svg>
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-ink-soft">{children}</p>
    </details>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/Accordion.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/Accordion.tsx
git commit -m "$(printf 'feat(design): editorial accordion (details/summary)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: BuyPanel component

**Files:** Create `src/components/shop/BuyPanel.tsx`.

Client component owning the right column. Absorbs `VariantSelector`'s logic (selection → matched variant → ready/inStock/price) and renders breadcrumbs, title, price, description, size grid, CTA, accordions.

- [ ] **Step 1: Create it.**

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { Accordion } from '@/components/shop/Accordion';
import { WaitlistButton } from '@/components/shop/WaitlistButton';
import type { Database } from '@/db/types.gen';

type Variant = Database['public']['Tables']['variants']['Row'];

export function BuyPanel({
  name,
  description,
  category,
  options,
  variants,
  basePriceThb,
}: {
  name: string;
  description: string;
  category: string | null;
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
  const inStock = !!matched && matched.stock_available > 0;
  const price = matched?.price_thb ?? basePriceThb;

  return (
    <div className="lg:pl-6">
      <nav className="flex flex-wrap gap-2 pb-8 text-xs uppercase tracking-[0.12em] text-muted">
        <span>{t('breadcrumbHome')}</span>
        {category && (
          <>
            <span aria-hidden>—</span>
            <span>{category}</span>
          </>
        )}
      </nav>

      <h1 className="pb-4 font-serif text-4xl leading-tight text-ink">{name}</h1>
      <p className="pb-8 text-lg text-muted">฿{price.toLocaleString()}</p>

      {description && (
        <div className="border-t border-line pb-8 pt-8">
          <p className="whitespace-pre-line text-base leading-relaxed text-ink-soft">{description}</p>
        </div>
      )}

      <div className="space-y-4 pb-8">
        {options.map((opt) => (
          <div key={opt.name} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-ink">
              {t(opt.name === 'size' ? 'size' : 'color')}
            </p>
            <div className="flex flex-wrap gap-3">
              {opt.values.map((v) => {
                const sel = selection[opt.name] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => setSelection({ ...selection, [opt.name]: v })}
                    className={`border px-6 py-3 text-sm transition-colors ${
                      sel
                        ? 'border-ink text-ink'
                        : 'border-muted text-muted hover:border-ink hover:text-ink'
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="pb-12">
        {ready && !inStock ? (
          <WaitlistButton variantId={matched?.id ?? null} />
        ) : (
          <AddToCartButton variantId={matched?.id ?? null} ready={ready} outOfStock={false} />
        )}
      </div>

      <div className="border-t border-line">
        <Accordion title={t('detailsTitle')}>{t('detailsBody')}</Accordion>
        <Accordion title={t('shippingTitle')}>{t('shippingBody')}</Accordion>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/BuyPanel.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/BuyPanel.tsx
git commit -m "$(printf 'feat(design): PDP BuyPanel (variant-aware purchase column)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Recompose PDP + delete VariantSelector

**Files:** Modify `src/components/shop/PDP.tsx`; delete `src/components/shop/VariantSelector.tsx`.

- [ ] **Step 1: Confirm VariantSelector has no other importers.** Run `wsl -d Ubuntu -- bash -lc "grep -rln VariantSelector /home/ton/workspace/rb_shop/src"`. Expected: only `PDP.tsx` (which we're about to change). If anything else imports it, STOP and report.

- [ ] **Step 2: Replace `src/components/shop/PDP.tsx`** with:

```tsx
import Image from 'next/image';
import type { ProductDetailData } from '@/server/queries/products';
import { BuyPanel } from './BuyPanel';

function imgAlt(
  img: { alt: unknown },
  locale: 'th' | 'en',
  fallback: string,
): string {
  const a = img.alt as { th?: string; en?: string } | null;
  return a?.[locale] ?? a?.en ?? fallback;
}

export function PDP({ data, locale }: { data: ProductDetailData; locale: 'th' | 'en' }) {
  const nameObj = data.product.name as { th?: string; en?: string };
  const descObj = data.product.description as { th?: string; en?: string };
  const name = nameObj[locale] ?? nameObj.en ?? nameObj.th ?? data.product.slug;
  const desc = descObj[locale] ?? descObj.en ?? '';
  const [main, ...rest] = data.images;
  const details = rest.slice(0, 2);

  return (
    <article className="container mx-auto px-6 py-16 lg:px-16">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-7">
          {main ? (
            <div className="aspect-[4/5] w-full overflow-hidden bg-field">
              <Image
                src={main.url_1600}
                alt={imgAlt(main, locale, name)}
                width={1600}
                height={2000}
                priority
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[4/5] w-full bg-field" />
          )}
          {details.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {details.map((img) => (
                <div key={img.id} className="aspect-square w-full overflow-hidden bg-field">
                  <Image
                    src={img.url_800}
                    alt={imgAlt(img, locale, name)}
                    width={800}
                    height={800}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <BuyPanel
            name={name}
            description={desc}
            category={data.product.category}
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

- [ ] **Step 3: Delete VariantSelector.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git rm src/components/shop/VariantSelector.tsx
```

- [ ] **Step 4: Typecheck + lint + build.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/PDP.tsx"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3"
```
Expected: TSC_OK, biome clean, `Compiled successfully`.

- [ ] **Step 5: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/PDP.tsx
git commit -m "$(printf 'feat(design): editorial PDP layout; fold VariantSelector into BuyPanel\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Visual gate

**Files:** none.

- [ ] **Step 1: Full gate.** `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` → typecheck clean, biome clean, 135 tests pass, `Compiled successfully`.

- [ ] **Step 2: Visual compare.** With the local stack up and a seeded active product (the `demo-tee` with 3 size variants), load `http://localhost:3000/en/product/demo-tee`:
  - Left: large 4/5 main image field (+ detail grid if ≥2 extra images).
  - Right: `Home — APPAREL` breadcrumb, Caslon title, grey price, bordered description, **SIZE** label + square S/M/L buttons (selected = ink border/text; others grey, hover→ink), full-width black **ADD TO CART** (disabled until a size is chosen), and the two accordions (Details & Care / Shipping & Returns) that expand on click.
  - Select an in-stock size → price/CTA enabled → Add to Cart opens the drawer. Select a sold-out size (set one variant's stock to 0 in Studio) → waitlist form appears.
  - `/th/product/demo-tee` → Thai strings + Plex Thai.
  Compare against `scratchpad/product-detail.png`. Fix obvious drift; otherwise report for review.

- [ ] **Step 3 (if fixes):** commit `fix(design): …`.

---

## Out of scope (later)

| Item | Phase |
|---|---|
| Cart restyle | 3 |
| About page | 4 |
| Per-product care/shipping fields | later |
| Image lightbox/zoom | later |
