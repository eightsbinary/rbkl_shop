# rb_shop — Manual PromptPay payments design

**Status:** Design approved 2026-06-29. Ready for plan.
**Goal:** Launch payments with a **manual PromptPay-QR + slip-upload** flow: the buyer pays to the creator's PromptPay QR, uploads the bank slip, and the creator verifies it in admin to confirm the order. $0 fees, no PSP signup. Architected so FeelFreePay (auto-confirm) can be added later as a second method.

## Decisions (locked with user)

| Decision | Choice |
|---|---|
| Strategy | Manual QR + slip is **the** launch payment method; FFP added later as a second `PaymentProvider` |
| QR source | **Admin-uploaded** `payment_settings` record (creator controls/updates it; not hardcoded) — I may pre-fill from Twitch but the creator confirms |
| Admin verification location | Inside the existing **`/admin/orders`** (no separate queue) |

## Data model

- **Order status:** add `awaiting_verification` to the `order_status` enum (between `awaiting_payment` and `paid`). `ALTER TYPE public.order_status ADD VALUE 'awaiting_verification'` (own migration; can't run inside a txn with other DDL, so isolate it).
- **`payment_slips`** — `id uuid pk`, `order_id uuid → orders(id)`, `storage_path text`, `status text ('pending'|'approved'|'rejected') default 'pending'`, `uploaded_at timestamptz default now()`, `reviewed_by uuid`, `reviewed_at timestamptz`, `reject_reason text`. RLS **service-role only** (admin reads; buyer writes go through a signed URL, not RLS). Index on `order_id`, `status`.
- **`payment_settings`** — singleton via `id text primary key default 'singleton' check (id = 'singleton')`: `promptpay_qr_path text`, `account_label text`, `instructions jsonb` (`{th,en}`), `updated_at`. RLS: owner/dev write; **public read** (the QR + instructions are shown to every buyer; the creator shares the QR publicly anyway).
- **Buckets:**
  - QR image → a **new public** bucket `payment-assets` (public read; owner/dev write). Kept separate from `product-images` for clarity.
  - Slips → a **private** `payment-slips` bucket. No public policies. Buyers upload via a **signed upload URL**; admin reads via a short-lived signed download URL (service role).

## Buyer flow

1. **Checkout** (`placeOrder`) creates the order `awaiting_payment`, `payment_method='promptpay_manual'`, and the checkout form redirects to the **order page** `/{locale}/order/{id}?t={token}` (token = existing `signOrderToken`).
2. **Order page** branches on status (token-gated, already the buyer's credential):
   - `awaiting_payment` → a **PaymentPanel**: the PromptPay **QR** (from `payment_settings`), the **amount**, instructions (TH/EN), and a **slip upload** (image picker → signed upload to `payment-slips/{orderId}/...` → submit).
   - On submit → order → `awaiting_verification`, insert a `payment_slips` row (`pending`), send a **"slip received — verifying"** email; panel shows "we'll confirm shortly".
   - `awaiting_verification` → "verifying" state (+ option to re-upload if it was rejected).
   - `paid` → confirmation.
3. **Slip upload authorization:** a route (`/api/storage/sign-slip-upload`) verifies the **order token** and that the order is `awaiting_payment`/`awaiting_verification`, then (service role) issues a signed upload URL for that order's slip path. Rate-limited + (optional) Turnstile. No login required (guest checkout; the token is the credential).

## Admin

- **Verification** in `/admin/orders`: orders `awaiting_verification` are flagged in the list; the **order detail** renders the uploaded slip (signed download URL) with **Approve** / **Reject**.
  - **Approve** → shared **`markOrderPaid(orderId, { source: 'manual', actor: 'owner' })`** (see Reuse) + slip → `approved`.
  - **Reject** → required reason → order back to `awaiting_payment`, slip → `rejected`, send **"slip not accepted — please re-upload"** email (with reason). The buyer's order page re-shows the upload.
- **Settings** (`/admin/settings` or a settings card): upload/replace the **PromptPay QR** (reuse the `ImagePicker`/signed-upload pattern) + edit `account_label` + `instructions` (TH/EN). Writes `payment_settings`.

## Reuse / architecture

- **Extract `markOrderPaid()`** (`src/server/orders/mark-paid.ts` or similar) from the current webhook route: set `status='paid'`, `paid_at`, `ship_status='preparing'`, decrement reserved stock, insert an `order_event`, send the existing **OrderPaid** email. Both the FFP webhook (later) and the manual **Approve** action call it. Keep the webhook's atomic dedup; `markOrderPaid` is the post-verification core.
- Manual flow does **not** go through the `PaymentProvider` `createCharge`/`verifyNotification` interface (that's webhook-shaped, for FFP). The `payment_method` column + the new status are the seam that lets both coexist.

## Emails (reuse `src/lib/email.ts` + `emails/`)

- New **SlipReceived** (verifying) and **SlipRejected** (re-upload, with reason) React Email templates. **OrderPaid** is reused on approval. All best-effort (never block the state transition).

## i18n

- New `pay.*` (buyer payment panel: QR caption, amount, instructions, upload CTA, statuses) and `admin.payments`/extend `admin.orders` (slip review, approve/reject, settings) — en + th, in sync.

## Security / constraints

- $0 / free tier. Slip bucket private; QR bucket public-read only.
- Slip upload gated by the order token + rate-limit (+ optional Turnstile); validate mime (image/jpeg|png|webp) + size cap.
- Admin approve/reject behind `requireOwnerOrDev` + the step-up gate (these are money actions).
- A buyer can re-upload after a rejection (the `payment_slips` audit trail keeps all attempts; the order page shows the latest).
- `simulateMockPayment`/MockProvider stays for dev only; the real default method is `promptpay_manual`.

## Testing

- Unit: `markOrderPaid` logic (stock decrement, status, idempotency) over a fake client; slip-upload-authorization (token valid/invalid, wrong order status); `payment_settings` read.
- Build + manual runtime: full flow on the local stack — checkout → order page QR + slip upload → `awaiting_verification` → admin approve → `paid` (email logged) → and the reject → re-upload path. TH/EN.
- Typecheck + biome + `next build` green; existing suite stays green.

## Out of scope (later)

| Item | Notes |
|---|---|
| FFP auto-confirm adapter | parked; slots in as a second `PaymentProvider` |
| Refunds UI; multiple QR/bank accounts | later |
| OCR / auto-reading slip amounts | later |
