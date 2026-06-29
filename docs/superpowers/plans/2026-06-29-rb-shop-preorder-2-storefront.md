# Pre-order — Plan 2 (storefront) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Surface pre-order to shoppers: the PDP shows a "Pre-order" badge, expected ship date, a "Pre-order now" CTA (replacing the waitlist on flagged sold-out variants), and a cap "X left" / "Pre-orders full" state; the buyer's order page reflects the pre-order. Plan 1 already built the data/checkout/admin layer.

**Architecture:** The `BuyPanel` (client) consumes the pure `@/domain/preorder` predicate over the matched variant + the product's `is_preorder`/`preorder_ship_date` (already in `ProductDetailData`) to choose the CTA. `AddToCartButton` gains a `preorder` mode. The order page tags pre-order line items + shows an "awaiting stock" note.

**Tech Stack:** Next.js 16, next-intl, Tailwind v4 Editorial Mono, Vitest. Bun except `next build` (offline = font-fetch only).

**Reference:** Spec [docs/superpowers/specs/2026-06-29-rb-shop-preorder-design.md](../specs/2026-06-29-rb-shop-preorder-design.md). Plan 1 (core) is shipped.

---

## Conventions (carry-over)

Branch `develop`, commit per task. `/tmp/p6a2-check.sh <files>` (tsc+biome), `/tmp/p6a2-gate.sh`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Bracketed route paths quoted in shell. The predicate `@/domain/preorder` exports `preorderActive(state)`, `preorderCapacity({preorderCap,preorderCount})`, `acceptsPreorder`, `lineMode` and the `VariantPreorderState` type. `ProductDetailData.product` already has `is_preorder` + `preorder_ship_date`; `ProductDetailData.variants` are full rows (incl. `preorder_enabled/cap/count`).

## File structure

```
src/components/cart/AddToCartButton.tsx     (modify — preorder mode/label)
src/components/shop/BuyPanel.tsx            (modify — pre-order CTA, badge, ship date, cap)
src/components/shop/PDP.tsx                 (modify — pass is_preorder + preorder_ship_date)
src/app/[locale]/order/[id]/page.tsx       (modify — pre-order line tag + awaiting_stock note)
src/server/queries/orders.ts (or wherever getOrderForGuest lives)  (modify — select is_preorder on items)
messages/{en,th}.json                       (modify — preorder.* namespace + order note keys)
```

---

## Task 1: PDP pre-order presentation

**Files:** `AddToCartButton.tsx`, `BuyPanel.tsx`, `PDP.tsx`, `messages/{en,th}.json`.

- [ ] **Step 1: i18n.** Add a top-level `preorder` namespace to BOTH `messages/en.json` and `messages/th.json` (valid JSON, en/th in sync). en values (use natural Thai for th):

```json
  "preorder": {
    "badge": "Pre-order",
    "cta": "Pre-order now",
    "shipBy": "Ships by ~{date}",
    "shipWhenReady": "Ships when available",
    "slotsLeft": "{n} left",
    "full": "Pre-orders full",
    "note": "This is a pre-order — it ships when stock arrives."
  }
```
Suggested th: badge "พรีออร์เดอร์", cta "พรีออร์เดอร์เลย", shipBy "จัดส่งราว ~{date}", shipWhenReady "จัดส่งเมื่อมีสินค้า", slotsLeft "เหลือ {n} ชิ้น", full "พรีออร์เดอร์เต็มแล้ว", note "นี่คือสินค้าพรีออร์เดอร์ — จะจัดส่งเมื่อสินค้าเข้า".

- [ ] **Step 2: `AddToCartButton` — pre-order mode.** Add a `preorder?: boolean` prop. When `preorder` is true the button is enabled despite zero stock and shows the pre-order label. Replace the component signature + `disabled` + label logic:

```tsx
export function AddToCartButton({
  variantId,
  ready,
  outOfStock,
  preorder = false,
}: {
  variantId: string | null;
  ready: boolean;
  outOfStock: boolean;
  preorder?: boolean;
}) {
  const t = useTranslations('pdp');
  const tp = useTranslations('preorder');
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const [added, setAdded] = useState(false);

  const disabled = !ready || (!preorder && outOfStock) || !variantId;
  // ...unchanged onClick (add + open + added flash)...
```
And in the label block, when not `added` and `ready` and not `outOfStock` (or `preorder`), show `preorder ? tp('cta') : t('addToCart')`:
```tsx
      ) : !ready ? (
        t('selectSize')
      ) : !preorder && outOfStock ? (
        t('outOfStock')
      ) : preorder ? (
        tp('cta')
      ) : (
        t('addToCart')
      )}
```

- [ ] **Step 3: `BuyPanel` — compute pre-order state + branch the CTA.** Add imports:
```tsx
import { useLocale } from 'next-intl';
import { preorderActive, preorderCapacity } from '@/domain/preorder';
```
Add props `isPreorder: boolean` and `preorderShipDate: string | null` to the component's prop type + destructure. After the existing `matched`/`ready`/`inStock`/`price` computations add:

```tsx
  const tp = useTranslations('preorder');
  const locale = useLocale();
  const preState = matched
    ? {
        isPreorder,
        preorderEnabled: matched.preorder_enabled,
        preorderCap: matched.preorder_cap,
        preorderCount: matched.preorder_count,
        stockAvailable: matched.stock_available,
      }
    : null;
  const canPreorder = preState ? preorderActive(preState) && preorderCapacity(preState) > 0 : false;
  const preorderFull = preState ? preorderActive(preState) && preorderCapacity(preState) <= 0 : false;
  const slotsLeft = preState ? preorderCapacity(preState) : 0;
  const showPreorderBadge = isPreorder || canPreorder || preorderFull;
  const shipDateLabel =
    preorderShipDate
      ? tp('shipBy', {
          date: new Date(preorderShipDate).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', {
            month: 'short',
            year: 'numeric',
          }),
        })
      : tp('shipWhenReady');
```

Add the badge near the price (replace the `<p>` price line with price + optional badge):
```tsx
      <div className="flex items-center gap-3 pb-8">
        <p className="text-lg text-muted">฿{price.toLocaleString()}</p>
        {showPreorderBadge && (
          <span className="rounded-full border border-ink px-2.5 py-0.5 text-xs uppercase tracking-[0.12em] text-ink">
            {tp('badge')}
          </span>
        )}
      </div>
```

Replace the CTA block (`<div className="pb-12">…</div>`) with the branched version:
```tsx
      <div className="pb-12">
        {!ready || inStock ? (
          <AddToCartButton variantId={matched?.id ?? null} ready={ready} outOfStock={false} />
        ) : canPreorder ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">{shipDateLabel}</p>
            {Number.isFinite(slotsLeft) && (
              <p className="text-xs uppercase tracking-[0.12em] text-muted">
                {tp('slotsLeft', { n: slotsLeft })}
              </p>
            )}
            <AddToCartButton variantId={matched?.id ?? null} ready={ready} outOfStock={false} preorder />
          </div>
        ) : preorderFull ? (
          <Button variant="solid" size="lg" className="w-full" disabled>
            {tp('full')}
          </Button>
        ) : (
          <WaitlistButton variantId={matched?.id ?? null} />
        )}
      </div>
```
Add `import { Button } from '@/components/ui/Button';` (for the disabled "full" button). (`Number.isFinite(slotsLeft)` hides the "X left" line for uncapped pre-orders where capacity is `Infinity`.)

- [ ] **Step 4: `PDP.tsx` — pass the props.** In the `<BuyPanel … />` call add:
```tsx
            isPreorder={data.product.is_preorder}
            preorderShipDate={data.product.preorder_ship_date}
```

- [ ] **Step 5: Validate JSON + tsc + biome + build + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/cart/AddToCartButton.tsx src/components/shop/BuyPanel.tsx src/components/shop/PDP.tsx messages/en.json messages/th.json"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3 || true"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/cart/AddToCartButton.tsx src/components/shop/BuyPanel.tsx src/components/shop/PDP.tsx messages/en.json messages/th.json
git commit -m "$(printf 'feat(preorder): PDP pre-order CTA, badge, ship date, cap\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Order page reflects pre-order

**Files:** the buyer order page `src/app/[locale]/order/[id]/page.tsx` + its guest-order query (likely `getOrderForGuest` in `src/server/queries/orders.ts` — grep to confirm); `messages/{en,th}.json`.

- [ ] **Step 1: Carry `is_preorder` on order items.** Find the guest-order query: `wsl -d Ubuntu -- bash -lc "grep -rn 'getOrderForGuest' /home/ton/workspace/rb_shop/src"`. In its `order_items` select, add `is_preorder` (e.g. change `.select('... qty, ...')` to include `is_preorder`). Confirm the returned item type exposes it.

- [ ] **Step 2: Tag pre-order line items + show the note.** In `src/app/[locale]/order/[id]/page.tsx`, where each item row renders (the items map), append a small "Pre-order" tag when `item.is_preorder`:
```tsx
                {item.is_preorder && (
                  <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
                    {tp('badge')}
                  </span>
                )}
```
And, when `order.ship_status === 'awaiting_stock'`, render the pre-order note near the status/summary:
```tsx
              {order.ship_status === 'awaiting_stock' && (
                <p className="text-sm text-ink-soft">{tp('note')}</p>
              )}
```
Add `const tp = await getTranslations('preorder');` (server component) — or `useTranslations` if the page is a client component; match the file's existing translation pattern. (The `preorder.badge`/`preorder.note` keys come from Task 1.)

- [ ] **Step 3: tsc + biome + build + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh 'src/app/[locale]/order/[id]/page.tsx' src/server/queries/orders.ts"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3 || true"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/[locale]/order/[id]/page.tsx" src/server/queries/orders.ts
git commit -m "$(printf 'feat(preorder): order page tags pre-order items + awaiting-stock note\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Gate

- [ ] **Step 1: Full gate.** `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` — tsc clean, biome clean, all 148 tests pass. (Build passes unless WSL offline — font fetch only.)

- [ ] **Step 2: Runtime (local stack + dev server).** Seed a sold-out, pre-orderable variant (e.g. a demo-tee variant: `stock_available=0, preorder_enabled=true, preorder_cap=3`). On the PDP `/{locale}/product/<slug>`, select that variant → confirm the **"Pre-order" badge**, the **ship-date / "ships when available"** line, **"3 left"**, and a **"Pre-order now"** button (NOT the waitlist). Click it → it adds to cart → checkout → order page shows the **"Pre-order" tag** on the line. Set the cap to a count-exhausted state (`preorder_count = preorder_cap`) and reload → the button reads **"Pre-orders full"** (disabled). Set `is_preorder=true` on a product with stock → badge shows but it still sells from stock until 0. Check TH + EN.
  (Browser↔local-Supabase caveats only affect image/slip uploads — the PDP + add-to-cart + order page render fine, as verified in Plan 1.) Restore the seeded variant afterward.

- [ ] **Step 3 (fixes):** commit `fix(preorder): …`.

---

## Out of scope (later)
- A "Pre-order" tag inside the **cart drawer / checkout summary** lines (would require the cart-preview API to compute per-line pre-order state). The PDP CTA + order page already make pre-order clear; this is a minor polish.
- Pre-order context in the **OrderPaid email** body (the order page covers confirmation).
