# rb_shop — Redesign Phase 4 design: Editorial Mono About page

**Status:** Pending spec review.
**Source:** Figma `8J3OHyJjRAnI4xnbafufYu` node `0:113` (About the Creator). Final storefront redesign phase (Phases 1–3 shipped). Direction locked: Editorial Mono, faithful layout. **New page** — there is no `/about` route yet.

## Goal

Build the `/about` page in the Editorial Mono language — an editorial creator story with three sections (hero, craftsmanship bento, inspiration) — and wire the `ABOUT` nav link. Content is **editable placeholder** (the creator supplies real bio + photos later); images are `field` placeholders.

## Layout (Figma node 0:113)

Standard `Header`/`Footer`. Page container `max-w-[1280px]`, `px-[64px]`.

### 1. Hero (`0:115`)
Two columns: left = serif **H1** (~64px, e.g. "Made with care.") + two body paragraphs (the creator's story); right = a portrait **image field** (~564×705, `field` bg). Stacks on mobile.

### 2. "Intentional Craftsmanship" — craft section (`0:124`)
Centered **H2** + a one-line subtext. Below, a bento row: left = a large **image field** (~760×572) with a small caption chip overlaid bottom-left ("Material — …"); right = a stacked pair of **text cards** (`surface` bg, `line` border), each = a small mark/icon + **H3** (e.g. "Made to last" / "Small batches") + a body paragraph.

### 3. Inspiration (`0:159`)
Two columns: left = a tall **image field** (~564×564, can be the dark/feature image); right = an uppercase **label** ("Inspiration") + serif **H2** (e.g. "Streaming & community") + two body paragraphs. Stacks on mobile.

## Components

```
src/app/[locale]/about/page.tsx          (new — composes the three sections)
src/components/shop/AboutHero.tsx        (new — heading + paragraphs + portrait field)
src/components/shop/CraftSection.tsx     (new — heading + captioned image + two text cards)
src/components/shop/InspirationSection.tsx (new — image + label + heading + paragraphs)
src/components/shop/Header.tsx           (modify — add the ABOUT nav link)
messages/{en,th}.json                    (new "about" namespace — all copy as editable placeholder)
```

(If the three sections are small enough, they may be plain functions inside `about/page.tsx` rather than separate files — decide during planning by size; the spec assumes separate focused components.)

## Content (placeholder, editable in i18n)

All copy lives under a new `about.*` i18n namespace so the creator edits it without touching code. Placeholder copy is rainbykello-flavored (a creator making merch with care for a Thai + international community), NOT the Figma's "brutalist architecture" text. Keys: `heroTitle`, `heroBody1`, `heroBody2`, `craftTitle`, `craftSubtitle`, `craftCaption`, `card1Title`, `card1Body`, `card2Title`, `card2Body`, `inspirationLabel`, `inspirationTitle`, `inspirationBody1`, `inspirationBody2`. Both en + th.

## Images

No creator photos exist and there is no about-image upload system. All images render as `bg-field` placeholder blocks at the right aspect ratios. A later phase can wire real images (static imports or a CMS field). Documented as placeholder.

## Header / nav

Add an **ABOUT** link to `Header` (left nav, after SHOP) → `/{locale}/about`, using the existing `nav.about` i18n key (already present in both locales).

## Constraints

- $0 / Tailwind v4 tokens; reuse `Header`/`Footer` (via the locale layout) and Editorial Mono tokens. No new deps.
- Responsive: each two-column section stacks under `lg`; the craft bento stacks (image, then cards).
- a11y: one `<h1>` (hero), section `<h2>`s, alt-less decorative image fields are empty divs (no `<img>` until real photos exist).
- The page is server-rendered (`setRequestLocale` + `getTranslations`), static-cacheable (no client state).

## Testing

- Visual: load `/en/about` at 1280px, compare to `scratchpad/about.png` — hero (serif H1 + paragraphs | portrait field), "Intentional Craftsmanship" + captioned image + two cards, inspiration (image | label + H2 + paragraphs). Header shows SHOP / ABOUT. `/th/about` → Thai + Plex Thai. ABOUT nav link works from any page.
- Typecheck + biome + `next build` green; existing unit suite stays green (135).

## Out of scope (later)

| Item | Phase |
|---|---|
| Real creator photos / image system for About | later |
| Checkout page restyle | later |
| Admin Thai i18n | separate plan |
