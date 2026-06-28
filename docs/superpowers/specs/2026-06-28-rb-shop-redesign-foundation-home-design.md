# rb_shop — Redesign Phase 1 design: Editorial Mono foundation + Home

**Status:** Design approved 2026-06-28 (pending spec review). 
**Source:** Figma "Untitled" (`8J3OHyJjRAnI4xnbafufYu`) — Editorial Mono storefront, 4 screens. This spec covers **Phase 1 only**: design-token foundation, shared chrome (TopNav/Footer/Button), and the **Home / Shop** page. PDP, Cart, About are later phases. Admin Thai-i18n is a separate plan.

## Decisions (locked with user)

| Decision | Choice |
|---|---|
| Direction | **Editorial Mono** — replaces the current "Soft Studio" warm/rose palette |
| Fidelity | Faithful layout/spacing/type; adapt content to real rainbykello products + TH/EN |
| Phasing | Foundation + Home now; PDP/Cart/About follow |
| Display serif | **Libre Caslon Text** (Figma's actual face) — replaces Fraunces for the storefront |
| Body sans | **Inter** (unchanged) + **IBM Plex Sans Thai** for Thai glyphs |
| Featured grid | Asymmetric **bento** (Figma) on Home; full "entire collection" listing stays a uniform grid |
| Newsletter | Styled section, **non-functional stub** for now (no newsletter backend yet) |
| Admin | Out of scope (internal tooling; unchanged) |

## Foundation — design tokens (`src/app/globals.css`)

Replace the Soft Studio `@theme` palette with Editorial Mono (values from the Figma reference code):

```
--color-paper:      #fbfbfa   /* page background (near-white neutral) */
--color-surface:    #ffffff   /* cards / PDP panels */
--color-field:      #f3f3f4   /* image placeholder fields */
--color-ink:        #111111   /* primary text / solid buttons */
--color-ink-soft:   #3a3a3a   /* secondary text */
--color-muted:      #5e5e5e   /* prices, captions, inactive filters */
--color-line:       #e2e2e2   /* hairline borders */
--color-ink-deep:   #1a1a1a   /* dark sections (Journal/hero overlay); text on it = paper */
--color-success/warn/error: keep, desaturated to suit mono
```

- Drop `--color-rose*`. `::selection` → neutral (`--color-line` bg / ink text).
- **Fonts** (`src/app/layout.tsx`): swap `Fraunces` → `Libre_Caslon_Text` (`weight: ['400','700']`, `--font-caslon`); keep `Inter` + `IBM_Plex_Sans_Thai`. Update `--font-serif: var(--font-caslon), var(--font-plex-thai), ui-serif, Georgia, serif;`.
- **Radii**: editorial = near-square. Default to `--radius-xs (2px)`/none for buttons & fields; keep small radii available.
- **Type scale** (from Figma): display/H1 ~72px Caslon; H2 32/40 Caslon; H3 24/32 Caslon; body 16/24 Inter; label 12px Inter `tracking 1.2px` uppercase; button 14px Inter `tracking 1.4px` uppercase. Keep the existing motion utilities.

## Shared chrome

### TopNav (`src/components/shop/TopNav` — restyle existing)
- 80px tall, paper bg, **bottom hairline** (`--color-line`). Left: nav links **SHOP / ABOUT** (Inter, uppercase-ish, small). Center: serif wordmark **rainbykello** (Caslon). Right: cart icon + item count. i18n labels via next-intl. Locale switch retained if present.

### Footer (`src/components/shop/Footer` — restyle existing)
- Paper bg, top hairline. Brand wordmark + `© <year> rainbykello`. Link columns (Newsletter / Privacy / Terms / Shipping) — placeholder routes ok. Minimal, generous whitespace.

### Button (`src/components/ui/Button` — extend variants)
- `solid`: ink bg, paper text, no radius, `px` generous. `outline`: 1px ink border, ink text, **uppercase 14px tracking 1.4px**, transparent bg, hover → ink fill/invert. Keep `ghost`. Preserve existing props/sizes; only restyle.

## Home / Shop page (`src/app/[locale]/(...)/page.tsx` — the storefront landing)

Layout container: `max-w-[1280px]`, `px-[64px]` (responsive: tighter on mobile). Sections stacked.

### 1. Hero
Full-bleed image block (real rainbykello hero/featured image; `--color-field` if none), ~870px tall on desktop. Subtle dark overlay for legibility. Centered or left content: serif **H1** headline + one-line subtext + **outline CTA** ("Explore new arrivals" → listing). Text = paper color over the image.

### 2. "Curated Pieces" — featured bento
- Header row: H2 **"Curated Pieces"** (Caslon 32/40) left; right = category filter links (All / Apparel / Accessories / …) — Inter 12px tracking 1.2px, active = ink + 1px bottom border, inactive = muted. Row has bottom hairline, `pb-[17px]`. (Filters may be visual-only in Phase 1 if category routing isn't wired; wire to existing category filter if trivial.)
- **Bento grid** — `grid-cols-12`, `gap-24`, 2 rows:
  - Slot A `col-[1/span_8] row-1` — large featured (image ~570px) 
  - Slot B `col-[9/span_4] row-1` — small (image ~368px, caption sits lower)
  - Slot C `col-[1/span_4] row-2` — small (image ~490px)
  - Slot D `col-[5/span_8] row-2` — wide (image ~326px)
- **Card** (`ProductCard` restyle): image in a `--color-field` frame (`object-cover`), then a row: left = name (Caslon 24/32) + material/subtitle (Inter 16/24 muted), right = price (Inter 16/24 ink). Whole card links to the PDP.
- **Data:** fill slots A–D from the top `is_featured && status='active'` products (fallback: most recent active). Fewer than 4 → render only the filled slots, preserving the asymmetric arrangement where possible. Subtitle maps from `category` or a short material field; price via existing money formatting.
- Below grid: centered **outline button** "View entire collection" → the full product listing (uniform 3-col grid — existing/Phase-later).

### 3. Newsletter "Journal"
Dark (`--color-ink-deep`) full-width band. Centered: H2 (paper) + subtext (muted-on-dark) + inline email input + **solid/inverted SUBSCRIBE button**. **Stub:** the form does not submit anywhere yet (disabled action or a client-only "thanks" with a `TODO` note); no backend wiring in Phase 1.

## Components touched / created

```
src/app/globals.css                 (modify — Editorial Mono tokens)
src/app/layout.tsx                  (modify — Libre Caslon Text)
src/components/ui/Button.tsx        (modify — solid/outline variants)
src/components/shop/TopNav.tsx      (modify/restyle — exact path TBD by reading)
src/components/shop/Footer.tsx      (modify/restyle)
src/components/shop/ProductCard.tsx (modify/restyle — bento card)
src/components/shop/Hero.tsx        (new or restyle)
src/components/shop/FeaturedBento.tsx (new — the 4-slot asymmetric grid)
src/components/shop/NewsletterBand.tsx (new — stub)
src/app/[locale]/page.tsx (or the landing route) (modify — compose the above)
messages/{en,th}.json               (modify — new storefront strings)
```
(Exact existing paths/route confirmed by reading the repo during planning.)

## Error handling / constraints

- $0 / Tailwind v4 `@theme` tokens only; no new runtime deps except the `Libre_Caslon_Text` next/font (build-time, free).
- Keep all existing data fetching, cart, i18n, and routing behavior — restyle only.
- Responsive: desktop matches Figma; below `md`, bento collapses to a single column, nav condenses (hamburger or stacked) — Phase 1 ships a sensible responsive fallback, not a separate mobile comp.
- Accessibility: maintain contrast (ink on paper ≥ AA), focus rings, `prefers-reduced-motion` (already handled).

## Testing

- Visual: run the app, compare Home against the Figma screenshot at 1280px; check the bento arrangement, type scale, hairlines, dark newsletter band.
- Typecheck + biome + `next build` green.
- No new unit tests (presentational); existing tests stay green.

## Out of scope (later phases)

| Item | Phase |
|---|---|
| Product Detail (PDP) restyle | 2 |
| Shopping Cart restyle | 3 |
| About the Creator page | 4 |
| Newsletter backend | later |
| Admin Thai i18n | separate plan |
