# Redesign Phase 3 — Editorial Mono Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the cart page to the Editorial Mono two-column layout (line items + Order Summary card) and the cart drawer to the same language (compact), sharing one cart-preview hook and one line-item component. No cart logic changes.

**Architecture:** New `useCartPreview` hook (fetch + subtotal + count) and `CartLineItem` (image/name/subtitle/stepper/remove/price, `compact` prop) factor the logic out of `CartContents`. New `OrderSummary` card. The cart page composes heading + line items + summary; the drawer composes compact line items + slim subtotal + checkout.

**Tech Stack:** Next.js 16, next-intl (ICU plurals), Tailwind v4 tokens (Editorial Mono), Zustand cart store. Bun except `next build` (Node). Local Supabase up for the visual gate.

**Reference:** Spec [docs/superpowers/specs/2026-06-29-rb-shop-redesign-cart-design.md](../specs/2026-06-29-rb-shop-redesign-cart-design.md). Figma cart screenshot `scratchpad/cart.png` (re-fetch node `0:3` if expired).

---

## Conventions (carry-over)

Branch `develop`, commit per task. Helper `/tmp/p6a2-check.sh <files>` = tsc + biome; `next build` = `~/.local/bin/node ./node_modules/next/dist/bin/next build`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Presentational — no new unit tests; existing suite stays green (135). The cart route path `src/app/[locale]/cart/page.tsx` has brackets — quote in shell.

## Cart store contract (already exists, do not change)
`useCart` lines: `CartLine{variantId,qty}`; `setQty(id,qty)` (qty≤0 removes the line); `remove(id)`; `setOpen(bool)`; `count()`. `CartPreviewLine` has `productName{th,en}`, `optionValues`, `unitPriceThb`, `imageUrl`, `productSlug`, `stockAvailable`.

## File structure

```
messages/en.json, messages/th.json      (modify — cart.pageTitle, itemsCount, orderSummary, shipping,
                                          shippingNote, total, secureCheckout, continueShopping, checkoutCta)
src/lib/use-cart-preview.ts             (new — hook)
src/components/cart/CartLineItem.tsx    (new — one line; compact prop)
src/components/cart/OrderSummary.tsx    (new — summary card)
src/app/[locale]/cart/page.tsx          (modify — Your Cart heading + 2-col)
src/components/cart/CartContents.tsx    (modify — drawer compact, uses hook + CartLineItem)
```

---

## Task 1: Cart i18n strings

**Files:** Modify `messages/en.json`, `messages/th.json`.

Existing `cart` keys: `title`, `empty`, `subtotal`, `checkout`. Add the rest.

- [ ] **Step 1: en.json** — merge into the existing `"cart"` object (keep existing keys):

```json
"pageTitle": "Your Cart",
"itemsCount": "{count, plural, one {# item} other {# items}}",
"orderSummary": "Order Summary",
"shipping": "Shipping",
"shippingNote": "Calculated at next step",
"total": "Total",
"secureCheckout": "Secure checkout",
"continueShopping": "Continue shopping",
"checkoutCta": "Proceed to checkout"
```

- [ ] **Step 2: th.json** — merge into its `"cart"` object (keep existing keys):

```json
"pageTitle": "ตะกร้าของคุณ",
"itemsCount": "{count} ชิ้น",
"orderSummary": "สรุปคำสั่งซื้อ",
"shipping": "ค่าจัดส่ง",
"shippingNote": "คำนวณในขั้นตอนถัดไป",
"total": "ยอดรวม",
"secureCheckout": "ชำระเงินปลอดภัย",
"continueShopping": "เลือกซื้อสินค้าต่อ",
"checkoutCta": "ดำเนินการชำระเงิน"
```

- [ ] **Step 3: Validate + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add messages/en.json messages/th.json
git commit -m "$(printf 'feat(i18n): cart page + order-summary strings\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: useCartPreview hook

**Files:** Create `src/lib/use-cart-preview.ts`.

Owns the `/api/cart/preview` fetch, preview state, subtotal, and count (lifted verbatim from the current `CartContents`).

- [ ] **Step 1: Create it.**

```ts
'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';
import type { CartPreviewLine } from '@/server/queries/cart';

/** Shared cart view-model: store lines + server preview (names/prices/images) +
 *  derived subtotal/count, plus the mutators both the page and drawer need. */
export function useCartPreview() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setOpen = useCart((s) => s.setOpen);
  const [preview, setPreview] = useState<CartPreviewLine[]>([]);

  useEffect(() => {
    if (lines.length === 0) {
      setPreview([]);
      return;
    }
    const ids = lines.map((l) => l.variantId);
    fetch('/api/cart/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json() as Promise<CartPreviewLine[]>)
      .then(setPreview)
      .catch(() => setPreview([]));
  }, [lines]);

  const subtotal = lines.reduce((acc, l) => {
    const p = preview.find((x) => x.variantId === l.variantId);
    return acc + (p?.unitPriceThb ?? 0) * l.qty;
  }, 0);
  const count = lines.reduce((acc, l) => acc + l.qty, 0);

  return { lines, preview, subtotal, count, setQty, remove, setOpen };
}
```

- [ ] **Step 2: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/lib/use-cart-preview.ts"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/lib/use-cart-preview.ts
git commit -m "$(printf 'feat(cart): shared useCartPreview hook\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: CartLineItem component

**Files:** Create `src/components/cart/CartLineItem.tsx`.

One line: image (links to PDP) + name (Caslon) + variant subtitle + a bordered − qty + stepper + line total + × remove. `compact` shrinks the image/typography for the drawer. No own separator border — parents wrap items in a `divide-y divide-line` container.

- [ ] **Step 1: Create it.**

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CartLine } from '@/lib/cart-store';
import type { CartPreviewLine } from '@/server/queries/cart';

export function CartLineItem({
  line,
  preview,
  locale,
  setQty,
  remove,
  compact = false,
}: {
  line: CartLine;
  preview: CartPreviewLine | undefined;
  locale: 'th' | 'en';
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  compact?: boolean;
}) {
  const name =
    preview?.productName[locale] ?? preview?.productName.en ?? preview?.productName.th ?? line.variantId;
  const subtitle = preview ? Object.values(preview.optionValues).join(' / ') : '';
  const unit = preview?.unitPriceThb ?? 0;
  const lineTotal = unit * line.qty;
  const href = preview ? `/${locale}/product/${preview.productSlug}` : undefined;
  const imgBox = compact ? 'h-20 w-20' : 'h-24 w-24 shrink-0 sm:h-44 sm:w-44';

  const image = (
    <div className={`overflow-hidden bg-field ${imgBox}`}>
      {preview?.imageUrl ? (
        <Image
          src={preview.imageUrl}
          alt={name}
          width={400}
          height={400}
          className="h-full w-full object-cover"
        />
      ) : null}
    </div>
  );

  return (
    <div className={`flex gap-4 ${compact ? 'py-4' : 'py-6 sm:gap-6'}`}>
      {href ? <Link href={href}>{image}</Link> : image}
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            {href ? (
              <Link href={href} className={`font-serif text-ink ${compact ? 'text-base' : 'text-xl'}`}>
                {name}
              </Link>
            ) : (
              <p className={`font-serif text-ink ${compact ? 'text-base' : 'text-xl'}`}>{name}</p>
            )}
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => remove(line.variantId)}
            className="text-muted transition-colors hover:text-ink"
            aria-label="remove"
          >
            ×
          </button>
        </div>
        <div className="mt-auto flex items-end justify-between pt-4">
          <div className="inline-flex items-center border border-line">
            <button
              type="button"
              onClick={() => setQty(line.variantId, line.qty - 1)}
              className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
              aria-label="decrease"
            >
              −
            </button>
            <span className="w-8 text-center text-sm text-ink">{line.qty}</span>
            <button
              type="button"
              onClick={() => setQty(line.variantId, line.qty + 1)}
              className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
              aria-label="increase"
            >
              +
            </button>
          </div>
          <p className="text-sm text-ink">฿{lineTotal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/cart/CartLineItem.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/cart/CartLineItem.tsx
git commit -m "$(printf 'feat(design): editorial cart line item\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: OrderSummary component

**Files:** Create `src/components/cart/OrderSummary.tsx`.

- [ ] **Step 1: Create it.**

```tsx
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export function OrderSummary({ subtotal, locale }: { subtotal: number; locale: 'th' | 'en' }) {
  const t = useTranslations('cart');
  const money = `฿${subtotal.toLocaleString()}`;
  return (
    <div className="border border-line bg-surface p-8">
      <h2 className="font-serif text-2xl text-ink">{t('orderSummary')}</h2>
      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{t('subtotal')}</dt>
          <dd className="text-ink">{money}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{t('shipping')}</dt>
          <dd className="text-muted">{t('shippingNote')}</dd>
        </div>
      </dl>
      <div className="mt-4 flex justify-between border-t border-line pt-4 text-base font-medium text-ink">
        <span>{t('total')}</span>
        <span>{money}</span>
      </div>
      <Link href={`/${locale}/checkout`}>
        <Button variant="solid" size="lg" className="mt-6 w-full">
          {t('checkoutCta')}
        </Button>
      </Link>
      <p className="mt-4 text-center text-xs text-muted">🔒 {t('secureCheckout')}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/cart/OrderSummary.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/cart/OrderSummary.tsx
git commit -m "$(printf 'feat(design): editorial order-summary card\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Cart page — Your Cart + 2-col

**Files:** Modify `src/app/[locale]/cart/page.tsx`.

- [ ] **Step 1: Replace the full file** with:

```tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartLineItem } from '@/components/cart/CartLineItem';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { useCartPreview } from '@/lib/use-cart-preview';

export default function CartPage() {
  const t = useTranslations('cart');
  const locale = useLocale() as 'th' | 'en';
  const { lines, preview, subtotal, count, setQty, remove } = useCartPreview();

  return (
    <section className="container mx-auto px-6 py-16 lg:px-16">
      <header className="space-y-2 pb-12 text-center">
        <h1 className="font-serif text-4xl text-ink lg:text-5xl">{t('pageTitle')}</h1>
        {lines.length > 0 && <p className="text-sm text-muted">{t('itemsCount', { count })}</p>}
      </header>

      {lines.length === 0 ? (
        <div className="space-y-4 text-center">
          <p className="text-muted">{t('empty')}</p>
          <Link
            href={`/${locale}/shop`}
            className="inline-block text-xs uppercase tracking-[0.12em] text-ink underline-offset-4 hover:underline"
          >
            {t('continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[1fr_368px]">
          <div className="divide-y divide-line border-t border-line">
            {lines.map((l) => (
              <CartLineItem
                key={l.variantId}
                line={l}
                preview={preview.find((p) => p.variantId === l.variantId)}
                locale={locale}
                setQty={setQty}
                remove={remove}
              />
            ))}
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <OrderSummary subtotal={subtotal} locale={locale} />
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + lint.** Run `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/app/[locale]/cart/page.tsx"` → TSC_OK, biome clean.

- [ ] **Step 3: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/[locale]/cart/page.tsx"
git commit -m "$(printf 'feat(design): editorial cart page (Your Cart + order summary)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Cart drawer — editorial compact

**Files:** Modify `src/components/cart/CartContents.tsx`.

- [ ] **Step 1: Replace the full file** with:

```tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartLineItem } from '@/components/cart/CartLineItem';
import { Button } from '@/components/ui/Button';
import { useCartPreview } from '@/lib/use-cart-preview';

export function CartContents() {
  const t = useTranslations('cart');
  const locale = useLocale() as 'th' | 'en';
  const { lines, preview, subtotal, setQty, remove, setOpen } = useCartPreview();

  if (lines.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 divide-y divide-line overflow-y-auto">
        {lines.map((l) => (
          <li key={l.variantId}>
            <CartLineItem
              line={l}
              preview={preview.find((p) => p.variantId === l.variantId)}
              locale={locale}
              setQty={setQty}
              remove={remove}
              compact
            />
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{t('subtotal')}</span>
          <span className="text-ink">฿{subtotal.toLocaleString()}</span>
        </div>
        <Link href={`/${locale}/checkout`} onClick={() => setOpen(false)}>
          <Button variant="solid" className="w-full">
            {t('checkout')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + build.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/cart/CartContents.tsx"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3"
```
Expected: TSC_OK, biome clean, `Compiled successfully`.

- [ ] **Step 3: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/cart/CartContents.tsx
git commit -m "$(printf 'feat(design): editorial cart drawer (compact, shared line item)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Visual gate

**Files:** none.

- [ ] **Step 1: Full gate.** `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` → typecheck clean, biome clean, 135 tests pass, `Compiled successfully`.

- [ ] **Step 2: Visual compare.** With the local stack up + a seeded active product, add 1–2 items to the cart (PDP → select size → add), then load `http://localhost:3000/en/cart` at 1280px and open the drawer (cart icon). Compare to `scratchpad/cart.png`:
  - Page: centered "Your Cart" + count; line items (image, Caslon name, variant subtitle, − qty + stepper, line total, × remove) on the left over a `divide-y`; Order Summary card right (Subtotal, Shipping "Calculated at next step", Total, full-width "Proceed to checkout", 🔒 Secure checkout).
  - Stepper +/− changes qty and subtotal/total; × removes; reaching qty 0 removes the line.
  - Drawer: compact list + slim subtotal + checkout; checkout link navigates and closes the drawer.
  - Empty cart → "your cart is empty" + Continue shopping.
  - `/th/cart` → Thai strings + Plex Thai.
  Fix obvious drift; otherwise report for review.

- [ ] **Step 3 (if fixes):** commit `fix(design): …`.

---

## Out of scope (later)

| Item | Phase |
|---|---|
| About page | 4 |
| Checkout page restyle | later |
| Real shipping in the summary | later |
