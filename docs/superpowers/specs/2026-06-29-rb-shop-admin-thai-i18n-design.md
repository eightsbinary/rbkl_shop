# rb_shop — Admin Thai i18n design

**Status:** Pending spec review.
**Goal:** Make the `/admin` area bilingual (TH/EN) with a cookie-based locale + a language toggle, then translate all admin UI copy. Admin URLs stay `/admin` (no `[locale]` prefix).

## Decision (locked with user)

Cookie + toggle — keep `/admin` URLs. (Not moving admin under `/[locale]/admin`.)

## Approach

### Locale resolution (`src/i18n/request.ts`)
`getRequestConfig` already returns the default when `requestLocale` is absent. The storefront always has a URL locale (`localePrefix: 'always'`), so its behavior is unchanged. For routes **without** a URL locale (i.e. `/admin`), read an `admin_locale` cookie and use it, defaulting to **`en`** (preserves today's English admin; Thai is opt-in via the toggle):

```ts
import { cookies } from 'next/headers';
// ...
const requested = await requestLocale;
if (hasLocale(routing.locales, requested)) {
  return { locale: requested, messages: load(requested) };
}
const cookieLocale = (await cookies()).get('admin_locale')?.value;
const locale = hasLocale(routing.locales, cookieLocale) ? cookieLocale : 'en';
return { locale, messages: load(locale) };
```

(`messages` still loads the same per-locale JSON; the new `admin.*` namespace rides along.)

### Toggle
- Server action `setAdminLocale(locale: 'th' | 'en')` (`src/server/actions/admin-locale.ts`): validates, sets the `admin_locale` cookie (httpOnly false so it's a simple UI pref; path `/admin`, 1-year max-age), then the caller `router.refresh()`es.
- `AdminLocaleToggle` (client, in `AdminNav`): two buttons TH / EN, active = ink, calls the action + `router.refresh()`.

### Strings
- New top-level `admin` namespace in `messages/{en,th}.json` holding every admin UI string (~50), grouped by area (`nav`, `dashboard`, `products`, `discounts`, `orders`, `ship`, `sync`, `waitlists`, `login`, `common`).
- Each admin component swaps hardcoded text for `useTranslations('admin')` (client) / `getTranslations('admin')` (server). Server admin pages already are async server components; client forms use the hook.

## Scope

**In:** the 23 `src/app/admin/**` + `src/components/admin/**` files' user-visible copy; AdminNav links; the login page; form labels/buttons/placeholders/empty-states; table headers; status/section headings. The toggle.

**Out:** validation/error *messages returned from server actions* (e.g. discount/ship errors) — these are returned strings from `src/server/actions/**`; localizing them is a follow-up (they're few and mostly already terse). `StatusPill`/`StepUpPrompt` copy is included. Storefront is unaffected.

## Constraints / edge cases

- `admin_locale` cookie default `en` → admin looks identical to today until toggled. Setting `path=/admin` scopes it so it never affects storefront (storefront ignores it anyway — it uses the URL locale).
- Admin layout/pages read `getTranslations('admin')`; ensure each admin route calls `setRequestLocale` is **not** needed (no `[locale]` param) — next-intl resolves via `getRequestConfig` per request. Server components can call `getTranslations` directly.
- Number/date formatting stays as-is (already locale-agnostic `toLocaleString`).
- a11y: toggle buttons get `aria-pressed`.

## Testing

- Visual/manual: load `/admin` (default EN) → all admin copy English; click **TH** in the nav → page refreshes, all admin copy Thai (Plex Thai font); reload → stays Thai (cookie); storefront `/en`,`/th` unaffected. Spot-check each admin screen (dashboard, products list + form, discounts list + form, orders list + detail + ship form, waitlists, sync, login).
- Typecheck + biome + `next build` green; existing unit suite stays green (135). next-intl will throw at build/runtime for any **missing** message key referenced — so en and th `admin` namespaces must be complete and identical in shape.

## Out of scope (later)

| Item | Notes |
|---|---|
| Localizing server-action error strings | follow-up |
| Admin email templates in Thai | follow-up |
| Per-key fallback if a translation is missing | not needed if catalogs stay in sync |
