# Pre-order — Plan 1 (core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make pre-order work end-to-end on the data + checkout + admin side: schema + a pure pre-order predicate, `placeOrder` that books pre-order slots instead of stock, `markOrderPaid` that flags the order `awaiting_stock`, slot release on cancel/fail, an admin editor for the new controls (with a non-destructive variant sync), and `awaiting_stock` surfaced in the admin orders list. Storefront presentation is **Plan 2**.

**Architecture:** Pre-order is a flagged order line backed by a per-variant `preorder_count` counter (parallels `stock_reserved`). One pure predicate (`src/domain/preorder.ts`) decides whether a variant+qty is in-stock / pre-order / unavailable; `placeOrder` and the admin/storefront consume it. `syncVariants` becomes an in-place upsert so the counter survives product edits.

**Tech Stack:** Next.js 16, Supabase (Postgres, RLS), Zod, Vitest, next-intl. Bun except `next build` (Node; offline = blocked only on Google-Fonts fetch). Local Supabase up for migrations + runtime.

**Reference:** Spec [docs/superpowers/specs/2026-06-29-rb-shop-preorder-design.md](../specs/2026-06-29-rb-shop-preorder-design.md).

---

## Conventions (carry-over)

Branch `develop`, commit per task. Helpers: `/tmp/p6a2-check.sh <files>` (tsc+biome), `/tmp/vitest.sh <file>`, `/tmp/p6a2-gate.sh` (full gate). DB: `~/.local/bin/supabase migration up`; types via `bun run db:types`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. **Requires the local Supabase stack running** for Tasks 1 & 9.

## File structure

```
supabase/migrations/20260629003000_ship_status_awaiting_stock.sql   (new — enum value, isolated)
supabase/migrations/20260629003100_preorder_columns.sql             (new — product/variant/order_item cols)
src/db/types.gen.ts                                                  (regenerated)
src/components/admin/StatusPill.tsx                                  (modify — awaiting_stock tone+label)
messages/{en,th}.json                                               (modify — shipStatus.awaiting_stock + editor + filter)
src/domain/preorder.ts                                              (new — predicate)
tests/unit/domain/preorder.test.ts                                  (new)
src/server/actions/products.ts                                      (modify — syncVariants upsert + preorder fields)
tests/unit/server/sync-variants.test.ts                            (new)
src/server/actions/orders.ts                                       (modify — placeOrder line-mode)
src/server/orders/mark-paid.ts                                     (modify — awaiting_stock ship_status)
src/app/api/payments/notify/[provider]/route.ts                   (modify — release preorder slot on fail)
src/components/admin/ProductForm.tsx                              (modify — preorder controls)
src/server/queries/admin-orders.ts                                (modify — ship_status filter)
src/app/admin/orders/page.tsx                                     (modify — awaiting_stock filter UI)
```

---

## Task 1: Migration — columns, enum, exhaustive maps

**Files:** the two migrations; `StatusPill.tsx`; `messages/{en,th}.json`; regen types.

- [ ] **Step 1: Isolated enum migration.** `supabase/migrations/20260629003000_ship_status_awaiting_stock.sql`:

```sql
-- Paid order whose items aren't in stock yet (pre-order). Not a terminal ship state.
alter type public.ship_status add value if not exists 'awaiting_stock' after 'pending';
```

- [ ] **Step 2: Columns migration.** `supabase/migrations/20260629003100_preorder_columns.sql`:

```sql
alter table public.products
  add column if not exists is_preorder boolean not null default false,
  add column if not exists preorder_ship_date date;

alter table public.variants
  add column if not exists preorder_enabled boolean not null default false,
  add column if not exists preorder_cap int check (preorder_cap is null or preorder_cap >= 0),
  add column if not exists preorder_count int not null default 0 check (preorder_count >= 0);

alter table public.order_items
  add column if not exists is_preorder boolean not null default false;
```

- [ ] **Step 3: Apply + regen types.** Write `\\wsl.localhost\Ubuntu\tmp\preorder-db.sh`:

```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
supabase migration up 2>&1 | tail -8
bun run db:types 2>&1 | tail -4
```
Run `wsl -d Ubuntu -- bash -lc "bash /tmp/preorder-db.sh"`. Verify: `wsl -d Ubuntu -- bash -lc "grep -c -E 'preorder_enabled|preorder_count|is_preorder' /home/ton/workspace/rb_shop/src/db/types.gen.ts"` → ≥ 3; and `wsl -d Ubuntu -- bash -lc "docker exec supabase_db_rb_shop psql -U postgres -tAc \"select unnest(enum_range(null::public.ship_status))::text;\" | grep awaiting_stock"` → prints `awaiting_stock`.

- [ ] **Step 4: Fix exhaustive maps so tsc passes.** The new `ship_status` value breaks the `Record<ShipStatus, …>` maps. In `src/components/admin/StatusPill.tsx` add to BOTH `shipTone` and the `ShipStatusPill` `labels` map:
  - `shipTone`: `awaiting_stock: 'bg-warn/15 text-warn',`
  - `labels`: `awaiting_stock: t('shipStatus.awaiting_stock'),`
  Add the i18n key `admin.orders.shipStatus.awaiting_stock` to en (`"Awaiting stock"`) and th (`"รอสินค้าเข้า"`). Then grep for any other `Record<ShipStatus` or `shipStatus` label map and add the case: `wsl -d Ubuntu -- bash -lc "grep -rn 'ShipStatus,' /home/ton/workspace/rb_shop/src; grep -rn 'shipStatus' /home/ton/workspace/rb_shop/src/app/admin/orders/page.tsx"` — fix each (e.g. a `shipStatusLabels` in `admin/orders/page.tsx`, if present, gets `awaiting_stock: t('shipStatus.awaiting_stock')`).

- [ ] **Step 5: tsc + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.bun/bin/bun run tsc --noEmit 2>&1 | tail -5 && echo TSC_OK"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add supabase/migrations/20260629003000_ship_status_awaiting_stock.sql supabase/migrations/20260629003100_preorder_columns.sql src/db/types.gen.ts src/components/admin/StatusPill.tsx messages/en.json messages/th.json src/app/admin/orders/page.tsx
git commit -m "$(printf 'feat(preorder): schema (product/variant/order_item cols, awaiting_stock)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Pre-order predicate (TDD)

**Files:** Create `src/domain/preorder.ts`, `tests/unit/domain/preorder.test.ts`.

- [ ] **Step 1: Failing test.** `tests/unit/domain/preorder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lineMode, preorderCapacity } from '@/domain/preorder';

const variant = (over: Partial<Parameters<typeof lineMode>[0]> = {}) => ({
  isPreorder: false,
  preorderEnabled: false,
  preorderCap: null as number | null,
  preorderCount: 0,
  stockAvailable: 0,
  ...over,
});

describe('lineMode', () => {
  it('sells from stock when available', () => {
    expect(lineMode(variant({ stockAvailable: 5 }), 3)).toBe('in_stock');
  });
  it('is unavailable when sold out and not pre-orderable', () => {
    expect(lineMode(variant({ stockAvailable: 0 }), 1)).toBe('unavailable');
  });
  it('pre-orders a sold-out variant flagged preorderEnabled (oversell)', () => {
    expect(lineMode(variant({ stockAvailable: 0, preorderEnabled: true }), 2)).toBe('preorder');
  });
  it('pre-orders a sold-out drop product', () => {
    expect(lineMode(variant({ stockAvailable: 0, isPreorder: true }), 2)).toBe('preorder');
  });
  it('blocks pre-order beyond the cap', () => {
    expect(lineMode(variant({ preorderEnabled: true, preorderCap: 5, preorderCount: 4 }), 2)).toBe('unavailable');
    expect(lineMode(variant({ preorderEnabled: true, preorderCap: 5, preorderCount: 4 }), 1)).toBe('preorder');
  });
  it('treats null cap as unlimited', () => {
    expect(lineMode(variant({ preorderEnabled: true, preorderCap: null, preorderCount: 9999 }), 50)).toBe('preorder');
  });
});

describe('preorderCapacity', () => {
  it('is Infinity for a null cap', () => {
    expect(preorderCapacity({ preorderCap: null, preorderCount: 3 })).toBe(Number.POSITIVE_INFINITY);
  });
  it('is the remaining slots for a set cap', () => {
    expect(preorderCapacity({ preorderCap: 10, preorderCount: 7 })).toBe(3);
    expect(preorderCapacity({ preorderCap: 10, preorderCount: 12 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run → fail.** `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/domain/preorder.test.ts"` → FAIL (module not found).

- [ ] **Step 3: Implement.** `src/domain/preorder.ts`:

```ts
export interface VariantPreorderState {
  isPreorder: boolean;      // product.is_preorder
  preorderEnabled: boolean; // variant.preorder_enabled
  preorderCap: number | null;
  preorderCount: number;
  stockAvailable: number;
}

export type LineMode = 'in_stock' | 'preorder' | 'unavailable';

/** Remaining pre-order slots; Infinity when uncapped. */
export function preorderCapacity(v: { preorderCap: number | null; preorderCount: number }): number {
  if (v.preorderCap == null) return Number.POSITIVE_INFINITY;
  return Math.max(0, v.preorderCap - v.preorderCount);
}

export function acceptsPreorder(v: Pick<VariantPreorderState, 'isPreorder' | 'preorderEnabled'>): boolean {
  return v.isPreorder || v.preorderEnabled;
}

/** Whether a variant currently takes pre-orders (accepts + sold out). */
export function preorderActive(v: VariantPreorderState): boolean {
  return acceptsPreorder(v) && v.stockAvailable === 0;
}

/** How a requested qty of a variant would be fulfilled right now. */
export function lineMode(v: VariantPreorderState, qty: number): LineMode {
  if (v.stockAvailable >= qty) return 'in_stock';
  if (preorderActive(v) && qty <= preorderCapacity(v)) return 'preorder';
  return 'unavailable';
}
```

- [ ] **Step 4: Run → pass.** `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/domain/preorder.test.ts"` → PASS.

- [ ] **Step 5: check + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/domain/preorder.ts tests/unit/domain/preorder.test.ts"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/domain/preorder.ts tests/unit/domain/preorder.test.ts
git commit -m "$(printf 'feat(preorder): pure line-mode predicate (TDD)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Non-destructive `syncVariants` (upsert by option_values)

**Files:** Modify `src/server/actions/products.ts`; create `tests/unit/server/sync-variants.test.ts`.

Today `syncVariants` deletes all variants then re-inserts, wiping `stock_reserved`/`preorder_count` and changing ids. Refactor to **upsert by `option_values`**: read existing variants, update matched ones in place, insert new combinations, delete removed ones.

- [ ] **Step 1: Pull the matching logic into a pure, tested helper.** Add to `src/domain/variant-matrix.ts` (where `generateVariants` lives) a pure function and test the diff. Create `tests/unit/server/sync-variants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diffVariants } from '@/domain/variant-matrix';

const ov = (size: string) => ({ size });

describe('diffVariants', () => {
  it('keeps matched, adds new, removes missing — by option_values', () => {
    const existing = [
      { id: 'a', option_values: ov('S') },
      { id: 'b', option_values: ov('M') },
    ];
    const desired = [ov('M'), ov('L')];
    const r = diffVariants(existing, desired);
    expect(r.keep.map((k) => k.id)).toEqual(['b']); // M matched -> update in place
    expect(r.add).toEqual([ov('L')]);               // L is new
    expect(r.removeIds).toEqual(['a']);             // S removed
  });
});
```

- [ ] **Step 2: Implement `diffVariants`** in `src/domain/variant-matrix.ts`:

```ts
function sameOptions(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return ak.length === bk.length && ak.every((k) => a[k] === b[k]);
}

export function diffVariants(
  existing: { id: string; option_values: Record<string, string> }[],
  desired: Record<string, string>[],
): {
  keep: { id: string; option_values: Record<string, string> }[];
  add: Record<string, string>[];
  removeIds: string[];
} {
  const keep = existing.filter((e) => desired.some((d) => sameOptions(e.option_values, d)));
  const add = desired.filter((d) => !existing.some((e) => sameOptions(e.option_values, d)));
  const removeIds = existing.filter((e) => !desired.some((d) => sameOptions(e.option_values, d))).map((e) => e.id);
  return { keep, add, removeIds };
}
```

- [ ] **Step 3: Run the diff test → pass.** `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/server/sync-variants.test.ts"`.

- [ ] **Step 4: Rewrite `syncVariants`** in `src/server/actions/products.ts` to use the diff and to persist per-variant pre-order config. Replace the whole `syncVariants` body (keep the `variant_options` upkeep, but make the variants part non-destructive):

```ts
async function syncVariants(
  supa: Supa,
  productId: string,
  axes: VariantAxis[],
  overrides: ProductInputT['variantOverrides'],
) {
  // variant_options describe the axes; safe to replace wholesale.
  await supa.from('variant_options').delete().eq('product_id', productId);
  if (axes.length > 0) {
    await supa.from('variant_options').insert(
      axes.map((a, i) => ({ product_id: productId, name: a.name, values: [...a.values], sort: i })),
    );
  }

  const drafts = generateVariants(axes); // [{ optionValues }]
  const { data: existing } = await supa
    .from('variants')
    .select('id, option_values')
    .eq('product_id', productId);
  const existingRows = (existing ?? []).map((e) => ({
    id: e.id,
    option_values: e.option_values as Record<string, string>,
  }));

  const { add, removeIds } = diffVariants(existingRows, drafts.map((d) => d.optionValues));

  // Remove only the combinations that disappeared.
  if (removeIds.length > 0) await supa.from('variants').delete().in('id', removeIds);

  const findOverride = (opts: Record<string, string>) =>
    overrides.find((o) => Object.entries(opts).every(([k, v]) => o.optionValues[k] === v));

  // Update kept variants in place (preserves id, stock_reserved, preorder_count).
  for (const e of existingRows) {
    if (removeIds.includes(e.id)) continue;
    const ov = findOverride(e.option_values);
    if (!ov) continue;
    await supa
      .from('variants')
      .update({
        price_thb: ov.priceThb ?? null,
        stock_available: ov.stockAvailable,
        preorder_enabled: ov.preorderEnabled ?? false,
        preorder_cap: ov.preorderCap ?? null,
      })
      .eq('id', e.id);
  }

  // Insert genuinely new combinations.
  if (add.length > 0) {
    const baseIdx = existingRows.length;
    await supa.from('variants').insert(
      add.map((opts, i) => {
        const ov = findOverride(opts);
        return {
          product_id: productId,
          sku: `${productId.slice(0, 8)}-${baseIdx + i}`,
          option_values: opts,
          price_thb: ov?.priceThb ?? null,
          stock_available: ov?.stockAvailable ?? 0,
          preorder_enabled: ov?.preorderEnabled ?? false,
          preorder_cap: ov?.preorderCap ?? null,
          is_active: true,
        };
      }),
    );
  }
}
```

Add the new override fields to the `ProductInput` zod schema's `variantOverrides`:

```ts
  variantOverrides: z.array(
    z.object({
      optionValues: z.record(z.string(), z.string()),
      priceThb: z.number().int().nullable(),
      stockAvailable: z.number().int().nonnegative(),
      preorderEnabled: z.boolean().default(false),
      preorderCap: z.number().int().nonnegative().nullable().default(null),
    }),
  ),
```

And extend the product insert/update in `saveProduct` to write `is_preorder` + `preorder_ship_date` (both branches):

```ts
        is_preorder: input.isPreorder ?? false,
        preorder_ship_date: input.preorderShipDate ?? null,
```
…and add to the `ProductInput` object schema: `isPreorder: z.boolean().default(false),` and `preorderShipDate: z.string().nullish(),`. Import `diffVariants` from `@/domain/variant-matrix`.

- [ ] **Step 5: tsc + biome + run all tests + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/actions/products.ts src/domain/variant-matrix.ts tests/unit/server/sync-variants.test.ts"
wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh 2>&1 | tail -4"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/actions/products.ts src/domain/variant-matrix.ts tests/unit/server/sync-variants.test.ts
git commit -m "$(printf 'refactor(products): non-destructive variant sync (upsert by options) + preorder fields\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: `placeOrder` books pre-order slots

**Files:** Modify `src/server/actions/orders.ts`.

- [ ] **Step 1: Fetch pre-order fields.** In the `variants` select, add the new columns to the variant + product selections:
  - variant: `..., preorder_enabled, preorder_cap, preorder_count`
  - product: `products!inner(id, slug, name, base_price_thb, status, weight_grams, is_preorder)`

- [ ] **Step 2: Compute line mode + carry `is_preorder` on the draft.** In the item-building loop, replace the stock check `if (v.stock_available < line.qty) return { error: 'Not enough stock' };` with the predicate:

```ts
    const prod = Array.isArray(v.product) ? v.product[0] : v.product;
    const mode = lineMode(
      {
        isPreorder: prod?.is_preorder ?? false,
        preorderEnabled: v.preorder_enabled,
        preorderCap: v.preorder_cap,
        preorderCount: v.preorder_count,
        stockAvailable: v.stock_available,
      },
      line.qty,
    );
    if (mode === 'unavailable') {
      return { error: preorderActive({ isPreorder: prod?.is_preorder ?? false, preorderEnabled: v.preorder_enabled, preorderCap: v.preorder_cap, preorderCount: v.preorder_count, stockAvailable: v.stock_available }) ? 'Pre-orders are full' : 'Not enough stock' };
    }
```
Add `is_preorder: mode === 'preorder'` to the pushed `itemRows` object (extend the `ItemDraft` interface with `is_preorder: boolean`). Import `{ lineMode, preorderActive }` from `@/domain/preorder`. (`p` already aliases the product earlier in the loop — reuse it rather than re-deriving `prod` if it's in scope; keep one alias.)

- [ ] **Step 3: Branch the reservation loop.** Replace the stock-reservation `for` loop with a mode-aware one. Build a `byVariant` map of mode from the drafts (the loop already has `itemRows` with `is_preorder`); reserve accordingly:

```ts
  for (const row of itemRows) {
    const v = variants.find((x) => x.id === row.variant_id);
    if (!v) continue;
    if (row.is_preorder) {
      // Book a pre-order slot, guarding the cap atomically.
      let q = supa.from('variants').update({ preorder_count: v.preorder_count + row.qty }).eq('id', v.id);
      if (v.preorder_cap != null) q = q.lte('preorder_count', v.preorder_cap - row.qty);
      const { data: updated, error: updErr } = await q.select('id');
      if (updErr || !updated || updated.length === 0) return { error: 'Pre-orders are full' };
    } else {
      const { data: updated, error: updErr } = await supa
        .from('variants')
        .update({ stock_available: v.stock_available - row.qty, stock_reserved: v.stock_reserved + row.qty })
        .eq('id', v.id)
        .gte('stock_available', row.qty)
        .select('id');
      if (updErr || !updated || updated.length === 0) return { error: 'Not enough stock' };
    }
  }
```
(This also tightens the existing stock path by checking rows-affected.)

- [ ] **Step 4: Persist `is_preorder` on the items.** The `order_items` insert already spreads `itemRows`; since `is_preorder` is now a field on each row, it inserts automatically. Confirm the insert maps it (it does via `{ ...row, order_id }`).

- [ ] **Step 5: tsc + biome + build + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/actions/orders.ts"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3 || true"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/actions/orders.ts
git commit -m "$(printf 'feat(preorder): placeOrder books pre-order slots past stock\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: `markOrderPaid` → `awaiting_stock`

**Files:** Modify `src/server/orders/mark-paid.ts`.

- [ ] **Step 1:** After fetching `items` (the function already selects order items), compute whether any line is a pre-order and set `ship_status` accordingly. Change the items select to include `is_preorder`, and change the paid update:

In the items query add `is_preorder`:
```ts
  const { data: items } = await supa
    .from('order_items')
    .select('variant_id, qty, product_snapshot, is_preorder')
    .eq('order_id', orderId);
```
Move the `orders` "paid" update to AFTER the items fetch, and compute ship_status:
```ts
  const hasPreorder = (items ?? []).some((it) => it.is_preorder);
  await supa
    .from('orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      ship_status: hasPreorder ? 'awaiting_stock' : 'preparing',
    })
    .eq('id', orderId);
```
(Reorder so `items` is fetched before the orders update; the stock-release loop for in-stock lines and the rest stay the same. Pre-order lines should NOT have their `stock_reserved` decremented in the release loop — guard the loop with `if (it.is_preorder) continue;` since pre-order lines never touched `stock_reserved`.)

- [ ] **Step 2: Run the existing mark-paid test → still pass; add a case.** Extend `tests/unit/server/mark-paid.test.ts` with a test that an order containing an `is_preorder` item ends with `ship_status: 'awaiting_stock'` (and a non-preorder order → `'preparing'`). Use the existing fake-client shape; assert on the recorded `orders.update` payload.
`wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/server/mark-paid.test.ts"` → PASS.

- [ ] **Step 3: check + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/orders/mark-paid.ts tests/unit/server/mark-paid.test.ts"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/orders/mark-paid.ts tests/unit/server/mark-paid.test.ts
git commit -m "$(printf 'feat(preorder): paid pre-orders become awaiting_stock\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Release pre-order slots on cancel/fail

**Files:** Modify `src/app/api/payments/notify/[provider]/route.ts`.

The webhook's `failed`/`expired` branch returns reserved stock. Pre-order lines never reserved stock — they hold a `preorder_count` slot — so they must release that instead.

- [ ] **Step 1:** In the failed/expired branch, change the items select to `select('variant_id, qty, is_preorder')` and split the release:

```ts
    const { data: items } = await supa
      .from('order_items')
      .select('variant_id, qty, is_preorder')
      .eq('order_id', order.id);
    for (const it of items ?? []) {
      if (!it.variant_id) continue;
      const { data: v } = await supa
        .from('variants')
        .select('stock_available, stock_reserved, preorder_count')
        .eq('id', it.variant_id)
        .maybeSingle();
      if (!v) continue;
      if (it.is_preorder) {
        await supa
          .from('variants')
          .update({ preorder_count: Math.max(0, v.preorder_count - it.qty) })
          .eq('id', it.variant_id);
      } else {
        await supa
          .from('variants')
          .update({
            stock_available: v.stock_available + it.qty,
            stock_reserved: Math.max(0, v.stock_reserved - it.qty),
          })
          .eq('id', it.variant_id);
      }
    }
```

- [ ] **Step 2: tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh 'src/app/api/payments/notify/[provider]/route.ts'"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/api/payments/notify/[provider]/route.ts"
git commit -m "$(printf 'feat(preorder): release pre-order slot on payment fail/expire\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Admin editor — pre-order controls

**Files:** Modify `src/components/admin/ProductForm.tsx`; load current variant pre-order values into the editor; `messages/{en,th}.json`.

- [ ] **Step 1: Thread initial per-variant pre-order values.** The edit page builds `initial.variantOverrides` from the product's variants. Find where the product edit page constructs the `ProductForm` initial (grep: `wsl -d Ubuntu -- bash -lc "grep -rn 'variantOverrides' /home/ton/workspace/rb_shop/src/app/admin"`) and include `preorderEnabled`, `preorderCap`, and read-only `preorderCount` per variant in each override (selecting `preorder_enabled, preorder_cap, preorder_count` from variants). Extend `ProductFormInitial`/`ProductInputT` typing accordingly (the zod schema already has the override fields from Task 3; add `preorderCount` only to the form's initial display type, not the saved input).

- [ ] **Step 2: Product-level controls.** In the basics section of `ProductForm.tsx`, after the `isFeatured` checkbox, add an `isPreorder` checkbox + a `preorderShipDate` date input bound to new `state` fields. Add `isPreorder: initial.isPreorder ?? false` and `preorderShipDate: initial.preorderShipDate ?? ''` to the `useState` initializer and the `state` type (`ProductInputT` gained these in Task 3). Labels via `t('preorderProduct')` / `t('preorderShipDate')`.

```tsx
        <div className="flex items-center gap-2">
          <input id="isPreorder" type="checkbox" checked={state.isPreorder}
            onChange={(e) => setState({ ...state, isPreorder: e.target.checked })} />
          <Label htmlFor="isPreorder">{t('preorderProduct')}</Label>
        </div>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="preorderShipDate">{t('preorderShipDate')}</Label>
          <Input id="preorderShipDate" type="date" value={state.preorderShipDate ?? ''}
            onChange={(e) => setState({ ...state, preorderShipDate: e.target.value || undefined })} />
        </div>
```

- [ ] **Step 3: Per-variant controls.** The form currently edits axes, not individual variants. Add a **"Pre-order per variant"** sub-section under the variants section that lists each generated combination (compute via `generateVariants(state.axes)` imported from `@/domain/variant-matrix`) with a checkbox (`preorderEnabled`) + a cap number input (`preorderCap`), reading/writing `state.variantOverrides` (match by `optionValues`, upsert the override entry). Show the read-only `preorderCount` from `initial` if present. Keep it compact (a row per combination). Provide a helper to update an override:

```tsx
  function setOverride(optionValues: Record<string, string>, patch: { preorderEnabled?: boolean; preorderCap?: number | null }) {
    setState((s) => {
      const i = s.variantOverrides.findIndex((o) =>
        Object.entries(optionValues).every(([k, v]) => o.optionValues[k] === v));
      const base = i >= 0 ? s.variantOverrides[i]
        : { optionValues, priceThb: null, stockAvailable: 0, preorderEnabled: false, preorderCap: null };
      const next = { ...base, ...patch };
      const arr = i >= 0 ? s.variantOverrides.map((o, j) => (j === i ? next : o)) : [...s.variantOverrides, next];
      return { ...s, variantOverrides: arr };
    });
  }
```
Render one row per `generateVariants(state.axes)` entry using `setOverride`. (Note: `variantOverrides` must also carry `priceThb`/`stockAvailable` — when the form doesn't edit those elsewhere, default them from `initial` so a save doesn't zero stock. Confirm how the existing edit page seeds `variantOverrides` with stock and preserve it.)

- [ ] **Step 4: i18n.** Add to `admin.products` (en/th in sync): `preorderProduct` ("Pre-order product (sell before stock)"), `preorderShipDate` ("Expected ship date"), `preorderPerVariant` ("Pre-order per variant"), `preorderEnabled` ("Allow pre-order when sold out"), `preorderCap` ("Pre-order limit (blank = unlimited)"), `preorderCount` ("Pre-ordered"). Natural Thai.

- [ ] **Step 5: Validate JSON + tsc + biome + build + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/admin/ProductForm.tsx messages/en.json messages/th.json"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3 || true"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/admin/ProductForm.tsx src/app/admin messages/en.json messages/th.json
git commit -m "$(printf 'feat(preorder): admin product/variant pre-order controls\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: Admin orders — awaiting_stock filter

**Files:** Modify `src/server/queries/admin-orders.ts`, `src/app/admin/orders/page.tsx`.

- [ ] **Step 1: Add a ship_status filter** to `listAdminOrders`. Give it an optional second arg:

```ts
export async function listAdminOrders(status?: OrderStatus, shipStatus?: ShipStatus): Promise<AdminOrderRow[]> {
  const supa = await createServerSupabase();
  let query = supa
    .from('orders')
    .select('id, number, customer_email, status, ship_status, total_thb, created_at')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (shipStatus) query = query.eq('ship_status', shipStatus);
  const { data } = await query;
  return data ?? [];
}
```

- [ ] **Step 2: Surface it in `admin/orders/page.tsx`.** Read the page; it already maps `searchParams.status` to a status filter and renders `OrderStatusPill`/`ShipStatusPill`. Add an `awaiting_stock` quick-filter (a link/tab `?ship=awaiting_stock`) that calls `listAdminOrders(undefined, 'awaiting_stock')`, and ensure the row renders the `ShipStatusPill` (it already shows the new `awaiting_stock` pill from Task 1). Label via `t('filterAwaitingStock')` ("Awaiting stock") — add to en/th.

- [ ] **Step 3: Validate JSON + tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/queries/admin-orders.ts src/app/admin/orders/page.tsx messages/en.json messages/th.json"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/queries/admin-orders.ts src/app/admin/orders/page.tsx messages/en.json messages/th.json
git commit -m "$(printf 'feat(preorder): admin orders awaiting_stock filter\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 9: Gate

- [ ] **Step 1: Full gate.** `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` — tsc clean, biome clean, all tests pass (preorder + sync-variants + mark-paid suites included). Build passes unless WSL is offline (font fetch only — confirm via `curl -s -o /dev/null -w '%{http_code}' https://fonts.googleapis.com` = `000`).

- [ ] **Step 2: Runtime (local stack + dev server).** Seed two scenarios via Studio/SQL and exercise:
  - **Oversell:** a normal active product variant; set `stock_available=0` + `preorder_enabled=true` + `preorder_cap=2`. Checkout qty 1 → order created, `order_items.is_preorder=true`, `variants.preorder_count=1`; approve the slip (admin) → order `paid`, `ship_status='awaiting_stock'`; the order appears under the admin `awaiting_stock` filter. A 3rd pre-order (count would exceed cap 2) → `placeOrder` returns "Pre-orders are full".
  - **Drop:** a product with `is_preorder=true`, variant `stock_available=0` → checkout → pre-order path same as above.
  - **Release:** trigger a failed payment (mock notify) on a pre-order → `preorder_count` decrements.
  Verify with: `docker exec supabase_db_rb_shop psql -U postgres -tAc "select preorder_count from variants where id='…';"` and the order's `ship_status`.
  (Browser image/upload caveats from the payments work still apply locally; the DB assertions are the source of truth.)

- [ ] **Step 3 (fixes):** commit `fix(preorder): …`.

---

## After Plan 1
Pre-order works at the data/checkout/admin layer. **Plan 2** adds the storefront presentation: PDP/BuyPanel "Pre-order" badge + "Pre-order now" CTA + cap "X left"/"full" + ship-date, the waitlist replacement on flagged sold-out variants, cart/checkout/order-page/email copy, and full `preorder.*` i18n (TH/EN).
