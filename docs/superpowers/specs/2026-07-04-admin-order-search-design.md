# Admin order search — design

**Date:** 2026-07-04 · **Status:** approved

## Problem

When a buyer asks the admin about their order (Instagram/Twitch DM with an email
or an order number), the admin has no way to find it in `/admin/orders` other
than scrolling. The buyer-facing `/track` page exists, but the admin-side lookup
is the simpler support path.

## Design

A search box on `/admin/orders` matching **order number OR customer email**,
partial and case-insensitive.

- **URL param `q`** alongside the existing `status` / `ship` params
  (`/admin/orders?status=paid&q=kello`). Bookmarkable; combines with the
  existing status filter pills.
- **UI:** a plain GET form above the table — text input, Enter submits, a ✕
  link clears (preserving the active status filter via hidden inputs / href).
  Server component only; no client state.
- **Query:** `listAdminOrders` gains an optional `q` parameter that adds
  `or(number.ilike.%q%, customer_email.ilike.%q%)` to the existing Supabase
  query. `q` is sanitized before interpolation: strip PostgREST `or()`
  syntax characters (`,`, `(`, `)`, `"`) and escape `ilike` wildcards
  (`%`, `_`, `\`). Blank/whitespace-only `q` is ignored.
- **Empty results** reuse the existing "no orders" message.
- **i18n:** new `admin.orders.searchPlaceholder` + `searchClear` keys (EN+TH).

## Out of scope (YAGNI)

- Live/debounced search-as-you-type (client component churn, marginal gain at
  current order volume).
- Searching customer name (lives in `shipping_address` JSON; buyers always
  know their email).

## Testing

Unit tests in the existing style (`tests/unit/server/`): sanitizer behavior
(wildcards escaped, PostgREST metacharacters stripped, blank ignored) and that
search composes with status/ship filters.
