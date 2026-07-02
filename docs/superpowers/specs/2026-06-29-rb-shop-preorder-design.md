# rb_shop — Pre-order products design

**Status:** Design approved 2026-06-29. Ready for plan.
**Goal:** Let the creator sell items that aren't in hand yet — both a deliberate **"upcoming drop"** (sell before any stock exists) and **"oversell when sold out"** (a flagged in-catalog item keeps selling past 0 stock). Buyers **pay in full now** via the existing manual-PromptPay flow; the order is a normal **paid** order that ships when stock arrives.

## Decisions (locked with user)

| Decision | Choice |
|---|---|
| Modes | **Both** — product-level "upcoming drop" + variant-level "oversell when sold out" |
| Payment timing | **Pay in full now** (reuse the manual-PromptPay + slip flow; no deposits/balance) |
| Cap | **Optional per-variant** max pre-order quantity (blank = unlimited); show "X left" / "pre-orders full" |
| Ship estimate | **Optional `preorder_ship_date` per product** ("Ships by ~…"); blank = "ships when available" |
| vs. waitlist | Pre-order **replaces** the waitlist on flagged sold-out variants; unflagged sold-out keeps the waitlist |
| Mixed carts | An order with any pre-order line is treated as pre-order **as a whole** and ships together (no partial shipments in v1) |

## Approach (chosen)

Pre-order is a **flagged order line backed by a per-variant counter** (mirrors the existing `stock_reserved` pattern). Pre-order activates when stock hits 0 for a variant that accepts it; pre-order lines skip stock and book a pre-order slot instead. The order flows through the existing payment + fulfillment machinery unchanged — it's just a paid order whose `ship_status` says it's waiting for stock. (Rejected: negative stock — breaks the `stock >= 0` invariant everywhere; a separate `preorders` table — duplicates the order/payment stack when pay-now means it already *is* an order.)

## Data model

- **`products`** (add): `is_preorder boolean not null default false` — the deliberate "upcoming drop"; presents the whole product as a pre-order. `preorder_ship_date date` (nullable) — optional expected ship/arrival date.
- **`variants`** (add): `preorder_enabled boolean not null default false` — "oversell when sold out". `preorder_cap int` (nullable, `check (preorder_cap is null or preorder_cap >= 0)`) — max pre-order qty; null = unlimited. `preorder_count int not null default 0 check (preorder_count >= 0)` — slots currently taken (the cap counter; parallels `stock_reserved`).
- **`order_items`** (add): `is_preorder boolean not null default false` — this line was placed as a pre-order.
- **`ship_status` enum** (add value): `awaiting_stock` — order is paid but waiting for stock to arrive. Isolate the `ALTER TYPE ... ADD VALUE` in its own migration (can't share a txn with DDL that uses it). It is **not** a terminal ship state — the creator later moves it to `shipped`.
- Existing exhaustive `Record<ShipStatus, …>` maps (StatusPill tones/labels, any admin ship-status label map) must gain the `awaiting_stock` case or tsc fails.

## Domain predicate — `src/domain/preorder.ts`

Single source of truth, pure + unit-testable. Given `{ isPreorder: boolean }` (product) + `{ preorderEnabled, preorderCap, preorderCount, stockAvailable }` (variant):

- `acceptsPreorder = product.isPreorder || variant.preorderEnabled`
- `preorderActive = acceptsPreorder && variant.stockAvailable === 0`
- `preorderCapacity = variant.preorderCap == null ? Infinity : Math.max(0, variant.preorderCap - variant.preorderCount)`
- `canPreorderQty(qty) = preorderActive && qty <= preorderCapacity`
- A purchase **line mode** for a variant + requested qty: `'in_stock'` if `stockAvailable >= qty`; else `'preorder'` if `canPreorderQty(qty)`; else `'unavailable'`.

Both modes fall out of one rule: a drop starts at `stock_available = 0` with `is_preorder`; oversell reaches 0 with `preorder_enabled`.

## Checkout & fulfillment flow

1. **`placeOrder`** — per line, compute line mode (above) against current variant state:
   - `in_stock` → reserve stock as today (`stock_available -= qty`, `stock_reserved += qty`).
   - `preorder` → `preorder_count += qty`, set `order_items.is_preorder = true`, **do not touch stock**.
   - `unavailable` → fail the order with a clear error ("sold out" / "pre-orders full"), releasing anything already reserved in this call (existing rollback behavior).
   - Concurrency: guard the cap the same way stock is guarded today (re-read + conditional update / the existing reservation guard) so two buyers can't exceed `preorder_cap`.
2. **Payment** — unchanged (full payment now; `payment_provider='promptpay_manual'`; the order page PaymentPanel; admin approves the slip).
3. **`markOrderPaid`** — after marking paid, set `ship_status = orderHasPreorderLine ? 'awaiting_stock' : 'preparing'` (query `order_items.is_preorder` for the order). Everything else (stock-reserved release for in-stock lines, OrderPaid email, event) unchanged.
4. **Release on cancel/fail** — the webhook's failed/expired branch (and any cancel path) must, for `is_preorder` lines, `preorder_count -= qty` (floored at 0) instead of returning stock. In-stock lines release stock as today.
5. **Fulfillment** — when stock arrives the creator restocks the variant, then ships the `awaiting_stock` orders with the **existing ShipOrderForm** (they're already `paid`) → `ship_status = 'shipped'`. `preorder_count` is the count of outstanding accepted pre-orders; it decrements only on cancel/refund, not on ship (the cap is the drop's accepted total; the creator can adjust the cap manually).

## Buyer UI

- **PDP / BuyPanel** — when `preorderActive` for the selected variant: a **"Pre-order"** badge, the ship-date line (`preorder_ship_date` → "Ships by ~<date>", else "ships when available"), a **"Pre-order now"** CTA (replaces "Add to cart" wording), and — if capped — "X left" or a disabled "Pre-orders full". When the product `is_preorder`, show the badge prominently regardless. This **replaces the waitlist CTA** on flagged sold-out variants; an unflagged sold-out variant keeps the existing waitlist ("notify me").
- **Cart / checkout** — pre-order lines carry a "Pre-order" tag; checkout proceeds normally (pay now).
- **Order page / confirmation email** — note the pre-order + ship-date; the paid order page reads "paid — ships when in stock" for `awaiting_stock`.

## Admin

- **Product/variant editor** — add the controls: product `is_preorder` toggle + `preorder_ship_date` date; per-variant `preorder_enabled` toggle + `preorder_cap` number; show read-only `preorder_count`. Follow the existing product-editor + ImagePicker/form patterns; owner/dev gated as today.
- **`syncVariants` fix (decided 2026-06-29):** the current `saveProduct` → `syncVariants` **deletes and re-inserts** all of a product's variants on every save, which would reset the live `preorder_count` (it already resets `stock_reserved` and nulls `order_items.variant_id`). Plan 1 refactors `syncVariants` to **upsert by `(product_id, option_values)`** — update matched variants in place (preserving `id`, `stock_reserved`, `preorder_count`), insert new option combinations, delete only the combinations that were removed. This makes per-variant caps reliable and fixes the latent stock/order-link bug.
- **Orders list** — an `awaiting_stock` badge + a filter so the creator sees what's waiting on stock. `StatusPill` gains the `awaiting_stock` label (warn tone, like `awaiting_payment`). Order detail still offers ShipOrderForm for paid orders (incl. `awaiting_stock`).

## i18n

New `preorder.*` (badge, "Pre-order now", "X left", "pre-orders full", ship-date phrasing, order-page note) + admin additions (editor labels, `awaiting_stock` ship label) — en + th, in sync.

## Security / constraints

- $0 / free tier; no new external services. Reuses the existing payment, auth, and step-up surfaces (no new money action beyond what manual-PromptPay already gates).
- Cap enforcement is server-side in `placeOrder` (never trust the client); concurrency-guarded so `preorder_count` cannot exceed `preorder_cap`.
- `is_preorder` / `preorder_enabled` / `preorder_cap` / `preorder_ship_date` are writable only by owner/dev (same RLS as other product/variant columns).

## Testing

- **Unit:** `src/domain/preorder.ts` (accepts/active/capacity/line-mode across in-stock, sold-out+enabled, drop, cap-remaining, cap-exhausted, unlimited). `placeOrder` line-mode handling (in-stock, pre-order, cap-exceeded → fail, mixed cart → order flagged). Release-on-cancel decrements `preorder_count` not stock. `markOrderPaid` sets `awaiting_stock` when a pre-order line exists, else `preparing`.
- **Runtime:** drop path (product `is_preorder`, stock 0 → pre-order → pay → `awaiting_stock` → restock → ship) and oversell path (sell to 0 → "Pre-order now" replaces waitlist → cap "X left" → cap full blocks), TH/EN.
- Typecheck + biome + tests green; `next build` green when WSL has internet (the font-fetch caveat from the payments work).

## Decomposition → two plans (each independently shippable)

1. **Plan 1 — Core:** migrations (product/variant/order_items columns + `awaiting_stock` enum + exhaustive-map fixes) + `src/domain/preorder.ts` (TDD) + `placeOrder` line-mode + `markOrderPaid` ship_status + cancel/fail release + admin product/variant editor controls + orders-list `awaiting_stock` badge/filter + StatusPill label. Pre-order works end-to-end; storefront shows a minimal label.
2. **Plan 2 — Storefront polish:** full PDP/BuyPanel pre-order presentation (badge, "Pre-order now", cap "X left"/"full", ship-date), waitlist replacement, cart/checkout/order-page/email copy, `preorder.*` i18n (TH/EN).

## Out of scope (later)

| Item | Notes |
|---|---|
| Deposits / partial payment | pay-now-full only in v1 |
| Partial shipment of mixed orders | mixed carts ship together |
| Pre-order analytics / per-drop reset UI | adjust `preorder_cap` manually for now |
| Auto-notifying pre-order buyers on restock | the creator ships; OrderShipped email already fires |
