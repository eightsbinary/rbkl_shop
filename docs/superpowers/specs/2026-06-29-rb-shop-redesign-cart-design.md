# rb_shop — Redesign Phase 3 design: Editorial Mono Cart

**Status:** Pending spec review.
**Source:** Figma `8J3OHyJjRAnI4xnbafufYu` node `0:3` (Shopping Cart). Continuation of the approved Editorial Mono redesign (Phases 1–2 shipped). Direction locked: Editorial Mono, faithful layout, real data, keep logic.

## Goal

Restyle the **cart page** to the Figma's two-column layout (line items with images + steppers + remove on the left; an Order Summary card on the right) and bring the **cart drawer** to the same editorial language in its compact single-column form — without changing cart state/logic.

## Layout (Figma node 0:3)

Standard `Header` retained (the Figma's simplified nav is skipped — not worth the divergence). Page container `max-w-[1280px]`, `px-[64px]`.

- **Heading:** centered Caslon **"Your Cart"** + a centered muted subline **"N items"**. (`pb` generous.)
- **Two columns** (`lg`): left ~⅔ = line items; right ~⅓ = Order Summary card. Below `lg`, stacks (items, then summary).

### Line item (left)
192×192 product image in a `field` frame · name (Caslon ~20px) + variant subtitle (option values, muted) · a bordered **− qty +** stepper · line price (right) · a **×** remove (top-right). Items separated by hairlines.

### Order Summary card (right)
`surface` bg, `line` border (subtle): Caslon **"Order Summary"** · **Subtotal** row (value) · **Shipping** row → "Calculated at next step" (muted) · hairline · **Total** row (bold) · full-width solid **"Proceed to checkout"** · a small centered **"🔒 Secure checkout"** note.

## Components

```
src/lib/use-cart-preview.ts          (new — hook: fetch /api/cart/preview, preview state, subtotal, count)
src/components/cart/CartLineItem.tsx (new — image + name/subtitle + stepper + remove + price; `compact` prop)
src/components/cart/OrderSummary.tsx (new — the summary card; subtotal/shipping/total/checkout/secure)
src/components/cart/CartContents.tsx (modify — drawer: editorial compact, uses the hook + CartLineItem compact + subtotal + checkout)
src/app/[locale]/cart/page.tsx       (modify — Your Cart heading + 2-col: CartLineItem list | OrderSummary)
messages/{en,th}.json                (modify — cart.itemsCount, shipping, shippingNote, total, secureCheckout, continueShopping?)
```

**Decision — extract shared cart logic.** `useCartPreview()` owns the `/api/cart/preview` fetch, the `preview` state, the subtotal, and the item count. `CartLineItem` renders one line (a `compact` prop: drawer = small image/typography, no per-line image on very narrow widths; page = 192px image). The cart page composes the heading + `CartLineItem` list + `OrderSummary`; the drawer (`CartContents`) composes compact `CartLineItem`s + a slim subtotal + checkout. This removes the duplicated fetch/subtotal currently inside `CartContents` and lets both surfaces share one source of truth.

## Data

`CartPreviewLine` already carries `imageUrl` (url_400), `productSlug`, `productName`, `optionValues`, `unitPriceThb`, `stockAvailable` — **no query change**. Subtitle = `Object.values(optionValues).join(' / ')` (e.g. "M / cream"). Line image links to the PDP (`/{locale}/product/{slug}`).

## Behavior (unchanged)

- Quantity `setQty` (min 1; `−` at qty 1 is disabled or removes — keep current behavior: `setQty(qty-1)`; if the store clamps at 1, keep that), `remove`, subtotal = Σ unitPrice×qty over the preview. Empty cart → an editorial empty state (muted line + a "continue shopping" link to `/shop`).
- **Shipping** is computed at checkout (existing flow), so the summary shows "Calculated at next step" — no shipping math here. **Total = subtotal** at this stage (shipping added at checkout); label it so it's not misleading (Total reflects items; shipping at next step).
- Checkout button → `/{locale}/checkout` (drawer also closes the drawer first, as today).

## Error handling / constraints

- Preview fetch failure → empty preview (names/prices blank but lines still render from the store); current behavior preserved.
- $0 / Tailwind v4 tokens; reuse `Button` `solid`/`outline`. No new deps.
- Responsive: page stacks under `lg`; stepper + remove stay usable on mobile.
- a11y: stepper buttons keep `aria-label`s; remove has `aria-label`; summary uses a real `<dl>` or labeled rows.

## Testing

- Visual: add 2 products to the cart, open `/en/cart` at 1280px — compare to `scratchpad/cart.png`: centered "Your Cart" + count, line items with images/steppers/remove, Order Summary card (subtotal, shipping note, total, Proceed to checkout, secure note). Open the **drawer** (cart icon) → compact editorial list + subtotal + checkout. `/th` → Thai + Plex Thai. Empty cart → empty state.
- Typecheck + biome + `next build` green; existing unit suite stays green (135).

## Out of scope (later)

| Item | Phase |
|---|---|
| About page | 4 |
| Checkout page restyle | later (separate) |
| Real shipping calc in summary | later |
| Stock/"reserved" messaging on lines | later |
