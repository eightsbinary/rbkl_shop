# rb_shop — Redesign Phase 2 design: Editorial Mono Product Detail (PDP)

**Status:** Pending spec review.
**Source:** Figma "Untitled" (`8J3OHyJjRAnI4xnbafufYu`), node `0:195` (Product Detail). Continuation of the approved Editorial Mono redesign; Phase 1 (foundation + Home) is shipped. Direction is locked: Editorial Mono, faithful layout, adapt to real products + TH/EN, keep all logic.

## Goal

Restyle the Product Detail page to the Figma's editorial two-column layout — a large image column (main + two detail images) on the left, and a purchase panel on the right (breadcrumbs, Caslon title, price, bordered description, SELECT SIZE squares, full-width ADD TO CART, Details/Shipping accordions) — preserving the existing variant selection, variant-aware pricing, add-to-cart, and sold-out→waitlist behavior.

## Layout (from Figma node 0:195)

12-col grid, page container `max-w-[1280px]`, `px-[64px]` (responsive). Left **7 cols** = imagery, right **5 cols** = purchase panel with `pl-[24px]`. Below `lg`, stacks (images then panel).

### Left — imagery (`0:197`)
- **Main image** ~662×827 (aspect ≈ 4/5) in a `field` frame, `object-cover`.
- Below it, a **two-up detail grid** (gap 8px) of the next two images (327×327 each). If the product has <3 images, render only what exists; with 1 image, just the main.

### Right — purchase panel (`0:205`)
- **Breadcrumbs** (`0:206`): `HOME — <CATEGORY>` — Inter 12px, tracking 1.2px, uppercase, `muted`. "HOME" links to `/shop`. Category from `product.category` (omit the dash + category if null). `pb-32`.
- **Title** (`0:211`): Caslon 32/40, ink. `pb-16`.
- **Price** (`0:214`): Inter 18/28, `muted`. Variant-aware (updates when a priced variant is chosen; default = base price). `pb-32`.
- **Description** (`0:217`): top hairline (`line`), `pt-33`, Inter 16/26, `ink-soft`, `whitespace-pre-line`. `pb-32`.
- **SELECT SIZE / variants** (`0:221`): per option, an uppercase label (Inter 12px tracking 1.2px) + a row of **square** option buttons (gap 16). Selected = `border-ink text-ink`; unselected = `border-muted text-muted hover:border-ink hover:text-ink`; `px-[25px] py-[13px]`, Inter 14px tracking ~0.05em, no radius. (Existing rounded/rose styling removed.)
- **ADD TO CART** (`0:232`): full-width **solid ink** button, uppercase, `py-[16px]`. When the chosen variant is sold out → the existing **WaitlistButton** instead (restyled full-width). Disabled until a full selection is made (existing `ready` logic).
- **Accordions** (`0:235`): top hairline, two `<details>`-based rows — **DETAILS & CARE** and **SHIPPING & RETURNS** — Inter 14px tracking 1.4px uppercase + chevron, `border-b line`. Content is **generic store-wide copy** from i18n (no per-product care/shipping fields exist).

## Components

```
src/components/shop/PDP.tsx              (modify — editorial 2-col; image column + <BuyPanel/>)
src/components/shop/BuyPanel.tsx         (new, client — the full right column: breadcrumbs, title,
                                          variant-aware price, description, size selector, CTA, accordions.
                                          Absorbs VariantSelector's selection/price/stock logic.)
src/components/shop/Accordion.tsx        (new — styled <details>/<summary> row)
src/components/shop/VariantSelector.tsx  (remove OR reduce to the size-grid sub-part used by BuyPanel;
                                          simplest: fold its logic into BuyPanel and delete the file)
src/components/cart/AddToCartButton.tsx  (modify — editorial full-width solid look; keep props/behavior)
src/components/shop/WaitlistButton.tsx   (modify — editorial full-width look; keep behavior)
messages/{en,th}.json                    (modify — pdp.* strings: breadcrumbHome, selectSize, addToCart,
                                          detailsTitle/Body, shippingTitle/Body)
```

**Decision — right column is one client component (`BuyPanel`).** The Figma puts the price under the title, but price is variant-dependent (client state). Rather than split the panel, `BuyPanel` (client) receives the static product strings (name, description, category) as props and owns selection → variant-aware price, the size grid, the CTA (add-to-cart / waitlist), and the accordions. The PDP server component renders the image column and passes `options`/`variants`/strings to `BuyPanel`. This keeps the variant-aware price while matching the Figma order. `VariantSelector`'s logic moves here; the old file is deleted (it has no other consumers — confirm during planning).

## Data

`getProductBySlug` already returns `product` (name, description, base_price_thb, category — add `category` to its select if absent), `images[]`, `options[]`, `variants[]`. No schema change. Breadcrumb category + accordion copy need no new data.

## Error handling / constraints

- Keep existing behaviors exactly: `ready` gating, sold-out → waitlist, variant matching, price fallback to base. Only the markup/classes and composition change.
- $0 / Tailwind v4 tokens; reuse `Button` `solid`/`outline` variants where they fit, else explicit classes. Accordions use native `<details>` (no JS) for resilience + zero deps.
- Responsive: below `lg`, single column (images then panel); size buttons wrap.
- a11y: `<details>`/`<summary>` are natively accessible; selected size button gets `aria-pressed`; maintain focus rings + contrast.

## Testing

- Visual: load a product PDP at 1280px, compare to the Figma screenshot (`scratchpad/product-detail.png`); verify breadcrumb, Caslon title, price, bordered description, square size buttons (selected/unselected states), full-width ADD TO CART, the two accordions expand/collapse, and the image column (main + detail grid). Verify sold-out variant → waitlist. Verify `/th` translations + Thai font.
- Typecheck + biome + `next build` green; existing unit suite stays green (135).

## Out of scope (later)

| Item | Phase |
|---|---|
| Cart restyle | 3 |
| About page | 4 |
| Per-product care/shipping content fields | later |
| Image zoom / gallery lightbox | later |
