# Dark mode + admin-managed background — design

Date: 2026-07-02
Status: approved (dark mode approved in chat; admin background added by user mid-design)

## Goal

1. Site-wide dark mode (storefront + admin) with a toggle button in the storefront
   header and admin nav. First visit follows the visitor's system preference
   (`prefers-color-scheme`) with no flash of the wrong theme; an explicit toggle
   choice persists and wins thereafter.
2. The admin can set the site background color (per theme) from Settings.

## Approach

CSS-token override. Every component already styles through the `@theme` tokens in
`src/app/globals.css` (`ink`/`paper`/`surface`/`field`/`line`/`muted`…), so dark mode
is a second set of values under `:root[data-theme='dark']` — near-zero component
churn. Rejected: Tailwind `dark:` classes everywhere (touches every file) and
`next-themes` (dependency for ~30 lines of code).

## Dark palette (Editorial Mono, inverted)

| Token | Light (unchanged) | Dark |
|---|---|---|
| paper (page bg) | `#fbfbfa` | `#121212` |
| surface (cards) | `#ffffff` | `#1a1a1a` |
| field / paper-warm | `#f3f3f4` | `#232323` |
| ink | `#111111` | `#ededea` |
| ink-soft | `#3a3a3a` | `#c2c2bf` |
| muted | `#5e5e5e` | `#9c9c98` |
| line | `#e2e2e2` | `#2e2e2e` |
| ink-deep (bands) | `#1a1a1a` | `#202020` (stays dark, slightly elevated) |
| rose / rose-deep / rose-soft | ink aliases | `#ededea` / `#ffffff` / `#2e2e2e` |
| success / warn / error | earth tones | brightened for dark-bg contrast |

Plus `color-scheme: dark` so native controls/scrollbars follow.

### Fixed tokens for dark bands and imagery

Dark editorial bands (hero overlay, Journal/Newsletter, Craft caption) keep light
text in **both** themes. Because `paper`/`ink` now invert, text over those bands
moves to two new constant tokens:

- `--color-paper-fixed: #fbfbfa` — always light
- `--color-ink-fixed: #111111` — always dark

Applied in: `Hero`, `NewsletterBand`, `CraftSection` caption chip, and the
`outline-paper` / `solid-paper` `Button` variants (which exist precisely for dark
bands). Everything else (`bg-ink text-paper` buttons, badges, DatePicker) inverts
coherently and stays as-is.

### Pinned-light scope

The receipt page is print-oriented and stays light in both themes via a
`.light-scope` class (re-declares the light token values on the wrapper; kept in
sync with `@theme` by comment).

## Theme selection & persistence

- `src/lib/theme.ts`: `resolveTheme(stored, systemDark)` — stored `'light'|'dark'`
  wins; anything else falls back to system. Unit-tested.
- Inline no-flash script in `src/app/layout.tsx` `<head>`: reads
  `localStorage['rb-theme']` → falls back to `matchMedia`, sets
  `document.documentElement.dataset.theme` before paint. `<html>` already has
  `suppressHydrationWarning`.
- `ThemeToggle` client component (`src/components/ui/ThemeToggle.tsx`): sun/moon
  inline SVGs whose visibility is CSS-driven via a Tailwind v4
  `@custom-variant dark ([data-theme='dark'] …)` — no hydration mismatch. Click
  flips `data-theme` + writes localStorage. While no explicit choice is stored, a
  `matchMedia` change listener follows live system changes. Label passed as a prop
  (new `nav.theme` / `admin.nav.theme` i18n keys, EN+TH).
- Placement: storefront `Header` (right cluster, next to `LocaleSwitcher`) and
  `AdminNav` (next to `AdminLocaleToggle`).

## Admin-managed background color

- Migration `site_appearance` (singleton, mirrors `home_content` RLS: public read,
  owner/dev write, `set_updated_at` trigger): `bg_light text null`,
  `bg_dark text null`, hex `check` constraints. Null → default palette value.
  (Not on `app_settings`: that table is owner-read-only; the storefront must read
  this anonymously.)
- `src/server/queries/site-appearance.ts` — `getSiteAppearance()`.
- `src/server/actions/site-appearance.ts` — `saveSiteAppearance` with
  `requireOwnerOrDev` + `stepUpGuard` + `#rrggbb` validation (same guard pattern
  as `saveEmailProvider`); `revalidatePath('/', 'layout')`.
- `[locale]/layout.tsx` renders an inline `<style>` overriding `--color-paper`
  for `:root` and `:root[data-theme='dark']` when overrides are set. Admin routes
  don't render this layout, so admin keeps the standard palette; the receipt's
  `.light-scope` re-declares `--color-paper` at element level and still wins.
- Admin Settings gains an **Appearance** section: two color pickers
  (light-theme background, dark-theme background) with reset-to-default, and a
  contrast hint. EN+TH strings.

## Testing / verification

- Vitest: `resolveTheme` cases; `saveSiteAppearance` hex validation.
- `bun run typecheck`, `bun run lint`, `bun run test`.
- Playwright pass over storefront (home, shop, PDP, cart, checkout) and admin in
  both themes to catch contrast stragglers.
