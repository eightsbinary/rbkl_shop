# rb_shop — Plan 6a-3 design: Webhook order-status guard

**Status:** Design approved 2026-06-28. Ready for plan.
**Parent:** Follow-up to Plan 6a-2 (`2026-06-28-rb-shop-security-hardening-2-design.md`), final-review finding #2.

## Goal

Make the payment-notify handler idempotent at the **order** level, not just the
event level. Plan 6a-2 added `(provider, event_id)` atomic dedup, which blocks
replays of the *same* event. But two *distinct* events for one order (e.g. a
double-clicked mock "paid", or a PSP that emits more than one success callback)
would each pass dedup and reprocess — double-decrementing stock and re-sending
the confirmation email. Guard the paid/failed transition so it only starts from
`awaiting_payment`.

## Scope

**In:** a single status guard in `src/app/api/payments/notify/[provider]/route.ts`.

**Out:** any schema change; reconciliation of exotic late transitions (belongs to
the real PSP adapter, Plan 6c); finding #1 (mock-payment auth — reframed as
already prod-mitigated and deferred).

## Change

After the order lookup `if (!order) return 404`, and **before** the amount check
and the atomic dedup insert, add:

```ts
if (order.status !== 'awaiting_payment') {
  return NextResponse.json({ ok: true, skipped: true });
}
```

`order_status` enum = `awaiting_payment | paid | failed | cancelled | refunded`.
Only `awaiting_payment` is processable; any terminal status short-circuits to a
200 `{ ok: true, skipped: true }`.

## Why before the dedup insert

A stale-status event is skipped without being recorded in
`processed_webhook_events` — correct, because the handler took no action on it,
so nothing about it needs to be remembered. (The order's terminal status is
itself the durable guard against re-processing.)

## Deliberate tradeoff

`awaiting_payment`-only means a `paid` event arriving **after** an order already
moved to `failed`/`cancelled` (an exotic out-of-band late capture) is skipped
rather than reconciled. That is the safe default for the current single-callback
flow; genuine out-of-band reconciliation is the real PSP adapter's job (6c). A
short code comment records this.

## Error handling

No new failure modes. The guard is a pure read of the already-fetched
`order.status`; it returns a success-shaped response (`{ ok: true, skipped: true }`)
because a duplicate/late delivery is not a client error — it is idempotent
success, matching how the dedup path returns `{ ok: true, dedup: true }`.

## Testing

The notify route is verified by build + a manual runtime check (no route-level
unit harness exists; route logic is integration-verified, pure logic is extracted
elsewhere). The single conditional does not warrant extracting a predicate.

**Runtime check (local Supabase up):** create/seed an `awaiting_payment` order,
then POST two signed mock `paid` events with **distinct** `eventId`s and the
order's amount:
- 1st → processes (order becomes `paid`, stock decremented once).
- 2nd → `{ ok: true, skipped: true }` (no second decrement, no second email).
Also re-confirms 6a-2's same-event dedup (`{ ok: true, dedup: true }` on an
identical replay).

## Docs

- README "Webhook replay hardening" subsection: note the order-status idempotency
  guard alongside the existing dedup + freshness description.
- Project memory: drop the "notify route doesn't check order.status" item from
  the known-gaps list.
