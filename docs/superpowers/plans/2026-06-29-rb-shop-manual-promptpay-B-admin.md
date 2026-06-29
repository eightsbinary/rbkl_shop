# Manual PromptPay — Plan B (admin verification + QR settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Complete the manual-PromptPay feature on the admin side: the creator reviews an uploaded slip in `/admin/orders/[id]`, **Approves** it (→ shared `markOrderPaid`) or **Rejects** it (→ reason + back to `awaiting_payment` + a re-upload email), and manages the **PromptPay QR + instructions** in a new `/admin/settings` screen.

**Architecture:** A service-role query returns the latest slip + a short-lived signed download URL. A `SlipReview` client component + `approveSlip`/`rejectSlip` server actions (gated by owner/dev + the step-up gate) drive verification on the existing order-detail page. A new `/admin/settings` page uploads the QR to the public `payment-assets` bucket (owner/dev-gated signed upload) and writes `payment_settings`.

**Tech Stack:** Next.js 16, Supabase (Storage + RLS), next-intl, React Email, Tailwind v4 Editorial Mono. Bun except `next build` (Node, but it's blocked offline by Google-Fonts fetch — rely on tsc/biome/tests; build only when WSL has internet).

**Reference:** Spec [docs/superpowers/specs/2026-06-29-rb-shop-manual-promptpay-payments-design.md](../specs/2026-06-29-rb-shop-manual-promptpay-payments-design.md). Plan A (foundation + buyer flow) is shipped.

---

## Conventions (carry-over)

Branch `develop`, commit per task. Helpers `/tmp/p6a2-check.sh <files>` (tsc+biome), `/tmp/vitest.sh`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Bracketed route paths quoted in shell. `markOrderPaid(supa, orderId, opts)` exists in `src/server/orders/mark-paid.ts`. `requireOwnerOrDev` + `stepUpGuard` in `src/db/auth.ts` (money actions use both). admin uses `useTranslations`/`getTranslations('admin.*')`; the `admin_locale` cookie + `NextIntlClientProvider` are already wired; en/th `admin.*` must stay in sync.

## File structure

```
src/server/queries/admin-payment.ts        (new — getOrderSlipReview: latest slip + signed download URL)
src/server/actions/verify-slip.ts          (new — approveSlip / rejectSlip)
emails/SlipRejected.tsx                     (new — re-upload email)
src/components/admin/SlipReview.tsx         (new, client — slip image + Approve/Reject)
src/app/admin/orders/[id]/page.tsx         (modify — render SlipReview when awaiting_verification)
src/app/api/storage/sign-asset-upload/route.ts (new — owner/dev signed upload to payment-assets)
src/server/actions/payment-settings.ts     (new — savePaymentSettings)
src/components/admin/PaymentSettingsForm.tsx (new, client — QR upload + label + instructions)
src/app/admin/settings/page.tsx            (new — settings screen)
src/components/admin/AdminNav.tsx          (modify — add Settings link)
messages/{en,th}.json                       (modify — admin.orders slip keys, admin.settings, admin.nav.settings)
```

---

## Task B1: Slip-review query + approve/reject actions + email

**Files:** Create `src/server/queries/admin-payment.ts`, `src/server/actions/verify-slip.ts`, `emails/SlipRejected.tsx`.

- [ ] **Step 1: Query.** `src/server/queries/admin-payment.ts`:

```ts
import 'server-only';
import { createServiceRoleSupabase } from '@/db/server';

export interface SlipReview {
  slipId: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
  imageUrl: string | null;
  rejectReason: string | null;
}

/** Latest slip for an order + a short-lived signed download URL (private bucket). */
export async function getOrderSlipReview(orderId: string): Promise<SlipReview | null> {
  const supa = createServiceRoleSupabase();
  const { data: slip } = await supa
    .from('payment_slips')
    .select('id, status, uploaded_at, storage_path, reject_reason')
    .eq('order_id', orderId)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!slip) return null;
  const { data: signed } = await supa.storage
    .from('payment-slips')
    .createSignedUrl(slip.storage_path, 600);
  return {
    slipId: slip.id,
    status: slip.status as SlipReview['status'],
    uploadedAt: slip.uploaded_at,
    imageUrl: signed?.signedUrl ?? null,
    rejectReason: slip.reject_reason,
  };
}
```

- [ ] **Step 2: SlipRejected email.** `emails/SlipRejected.tsx` — mirror `emails/SlipReceived.tsx`; props `{ orderNumber: string; orderUrl: string; reason: string }`; body: "We couldn't verify your payment slip for order {orderNumber}." + show `reason` + a link to `orderUrl` to re-upload. (Read `SlipReceived.tsx` first for the exact `_shell`/component imports.)

- [ ] **Step 3: Actions.** `src/server/actions/verify-slip.ts`:

```ts
'use server';

import SlipRejected from 'emails/SlipRejected';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';
import { markOrderPaid } from '@/server/orders/mark-paid';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
type Result = { ok: true } | { error: string };

export async function approveSlip(orderId: string): Promise<Result> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const svc = createServiceRoleSupabase();
  const { data: order } = await svc
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.status !== 'awaiting_verification') return { error: 'Order not awaiting verification' };

  await markOrderPaid(svc, orderId, { actor: 'owner' });
  await svc
    .from('payment_slips')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'pending');
  return { ok: true };
}

export async function rejectSlip(orderId: string, reason: string): Promise<Result> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
  const trimmed = reason.trim();
  if (!trimmed) return { error: 'A reason is required' };

  const svc = createServiceRoleSupabase();
  const { data: order } = await svc
    .from('orders')
    .select('id, status, number, customer_email, locale')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.status !== 'awaiting_verification') return { error: 'Order not awaiting verification' };

  await svc
    .from('payment_slips')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reject_reason: trimmed })
    .eq('order_id', orderId)
    .eq('status', 'pending');
  await svc.from('orders').update({ status: 'awaiting_payment' }).eq('id', orderId);
  await svc.from('order_events').insert({
    order_id: orderId,
    type: 'payment.slip_rejected',
    payload: { reason: trimmed },
    actor: 'owner',
  });

  try {
    const locale = order.locale === 'th' ? 'th' : 'en';
    const orderUrl = `${siteUrl()}/${locale}/order/${orderId}?t=${signOrderToken(orderId, order.customer_email)}`;
    await sendEmail({
      to: order.customer_email,
      subject: `Action needed — order ${order.number}`,
      react: SlipRejected({ orderNumber: order.number, orderUrl, reason: trimmed }),
    });
  } catch (err) {
    console.error('[rejectSlip] email failed', err);
  }
  return { ok: true };
}
```

(Adapt `sendEmail`/`order_events`/`SlipRejected` shapes to the real signatures if they differ.)

- [ ] **Step 4: tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/server/queries/admin-payment.ts src/server/actions/verify-slip.ts emails/SlipRejected.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/server/queries/admin-payment.ts src/server/actions/verify-slip.ts emails/SlipRejected.tsx
git commit -m "$(printf 'feat(pay): admin slip query + approve/reject actions + SlipRejected email\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task B2: SlipReview component + order-detail wiring + i18n

**Files:** Create `src/components/admin/SlipReview.tsx`; modify `src/app/admin/orders/[id]/page.tsx`, `messages/{en,th}.json`.

- [ ] **Step 1: i18n.** Add to `admin.orders` in BOTH en/th (in sync): `paymentSection` ("Payment"), `slipReceived` ("Payment slip received — review it below."), `viewSlip` ("View full size"), `approve` ("Approve payment"), `reject` ("Reject"), `rejectReasonLabel` ("Reason (shown to the buyer)"), `rejectConfirm` ("Reject & notify buyer"), `approving`/`rejecting`, `slipApproved`/`slipRejected`, `awaitingPaymentNote` ("Buyer hasn't uploaded a slip yet."), `noSlip` ("No slip uploaded."). Natural Thai for each. (`StatusPill` already has the `awaiting_verification` label.) Also `admin.common.stepUpRequired`? — reuse the existing `STEP_UP_REQUIRED` sentinel handling pattern from the other admin forms (`StepUpPrompt`).

- [ ] **Step 2: SlipReview (client).** `src/components/admin/SlipReview.tsx` — props `{ orderId: string; imageUrl: string | null }`. `useTranslations('admin.orders')`. Renders:
  - The slip image (`<img src={imageUrl}>` — private signed URL; plain img, not next/image) with a "view full size" link (opens `imageUrl` in a new tab). If `imageUrl` null → `t('noSlip')`.
  - **Approve** button (`Button variant="solid"`) → `approveSlip(orderId)`; on `{error:'stepUpRequired'}` render `<StepUpPrompt/>` (import from `@/components/admin/StepUpPrompt`), else show the error; on ok → `router.refresh()`.
  - **Reject**: a textarea (`rejectReasonLabel`) + a `Button variant="outline"` (`rejectConfirm`) → `rejectSlip(orderId, reason)`; same step-up/error/refresh handling.
  - `useState` for pending/error/reason; disable during pending. Editorial Mono. Mirror the existing `ShipOrderForm`/`StepUpPrompt` patterns for state + step-up handling.

- [ ] **Step 3: Wire into the order detail page.** In `src/app/admin/orders/[id]/page.tsx`: import `getOrderSlipReview` + `SlipReview`. Add a **Payment** card in the right `<section>` (above Fulfillment) that renders when `order.status === 'awaiting_verification'` (fetch `const slip = await getOrderSlipReview(order.id)` and render `<SlipReview orderId={order.id} imageUrl={slip?.imageUrl ?? null} />`), and when `order.status === 'awaiting_payment'` shows `t('awaitingPaymentNote')`. Keep everything else.

- [ ] **Step 4: Validate JSON + tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/admin/SlipReview.tsx 'src/app/admin/orders/[id]/page.tsx' messages/en.json messages/th.json"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/admin/SlipReview.tsx "src/app/admin/orders/[id]/page.tsx" messages/en.json messages/th.json
git commit -m "$(printf 'feat(pay): admin SlipReview on the order detail page\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task B3: Admin payment settings (QR upload)

**Files:** Create `src/app/api/storage/sign-asset-upload/route.ts`, `src/server/actions/payment-settings.ts`, `src/components/admin/PaymentSettingsForm.tsx`, `src/app/admin/settings/page.tsx`; modify `AdminNav.tsx`, `messages/{en,th}.json`.

- [ ] **Step 1: Owner/dev signed-upload route for payment-assets.** `src/app/api/storage/sign-asset-upload/route.ts` — mirror `sign-upload/route.ts` (which gates `requireOwnerOrDev` + signs to `product-images`), but bucket `payment-assets` and require the path to start with `qr/`:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

export async function POST(request: NextRequest) {
  try {
    const supa = await createServerSupabase();
    await requireOwnerOrDev(supa);
    const { path } = await request.json();
    if (typeof path !== 'string' || !path.startsWith('qr/')) {
      return NextResponse.json({ error: 'Bad path' }, { status: 400 });
    }
    const { data, error } = await supa.storage.from('payment-assets').createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Sign failed' }, { status: 500 });
    return NextResponse.json({ token: data.token, path: data.path });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }
}
```

- [ ] **Step 2: savePaymentSettings action.** `src/server/actions/payment-settings.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';

export async function savePaymentSettings(input: {
  promptpayQrPath?: string;
  accountLabel: string;
  instructions: { th?: string; en?: string };
}): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const svc = createServiceRoleSupabase();
  const patch: Record<string, unknown> = {
    account_label: input.accountLabel,
    instructions: input.instructions,
    updated_at: new Date().toISOString(),
  };
  if (input.promptpayQrPath) patch.promptpay_qr_path = input.promptpayQrPath;
  const { error } = await svc.from('payment_settings').update(patch).eq('id', 'singleton');
  if (error) return { error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}
```

- [ ] **Step 3: PaymentSettingsForm (client)** `src/components/admin/PaymentSettingsForm.tsx` — props `{ initialQrUrl: string | null; initialAccountLabel: string; initialInstructions: { th?: string; en?: string } }`. `useTranslations('admin.settings')`. A QR uploader (mirror `ImagePicker`: pick file → POST `/api/storage/sign-asset-upload` with `path = `qr/${Date.now()}.${ext}`` → `uploadToSignedUrl('payment-assets', ...)` → keep the uploaded `path` + show a preview via `createBrowserSupabase().storage.from('payment-assets').getPublicUrl(path)` as a plain `<img>`), inputs for `accountLabel` + `instructions.en`/`instructions.th`, and a Save button → `savePaymentSettings({...})` with the uploaded path (if any). Step-up/error handling like the other admin forms (`StepUpPrompt`). Editorial Mono.

- [ ] **Step 4: Settings page (server).** `src/app/admin/settings/page.tsx` — `getTranslations('admin.settings')` + read current settings via a small server read (reuse `getPaymentSettings()` from `@/server/queries/payment-settings` for the qrUrl/label/instructions) and render a heading + `<PaymentSettingsForm initial... />`.

- [ ] **Step 5: Nav + i18n.** Add a **Settings** link to `AdminNav` (after Waitlists/Sync) → `/admin/settings`, label `t('settings')` (add `admin.nav.settings` en/th). Add the `admin.settings` namespace (en/th in sync): `title`, `qrLabel` ("PromptPay QR"), `uploadQr`, `accountLabel`, `instructionsEn`, `instructionsTh`, `save`, `saving`, `saved`. Natural Thai.

- [ ] **Step 6: Validate + tsc + biome + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh 'src/app/api/storage/sign-asset-upload/route.ts' src/server/actions/payment-settings.ts src/components/admin/PaymentSettingsForm.tsx src/app/admin/settings/page.tsx src/components/admin/AdminNav.tsx messages/en.json messages/th.json"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/api/storage/sign-asset-upload/route.ts" src/server/actions/payment-settings.ts src/components/admin/PaymentSettingsForm.tsx src/app/admin/settings src/components/admin/AdminNav.tsx messages/en.json messages/th.json
git commit -m "$(printf 'feat(pay): admin payment settings (PromptPay QR + instructions)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task B4: Gate

- [ ] **Step 1:** `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` — tsc clean, biome clean, all tests pass. (The `next build` step may fail ONLY on the offline Google-Fonts fetch — that's environmental; confirm via `curl -s -o /dev/null -w '%{http_code}' https://fonts.googleapis.com` returning `000`. Treat build as passed if the only errors are the three font fetches.)
- [ ] **Step 2 (runtime, when feasible):** As an owner/dev in `/admin`, open an `awaiting_verification` order → the slip shows with Approve/Reject; Approve → order `paid` (+ confirmation email), Reject (with reason) → order back to `awaiting_payment` + the buyer's order page shows the re-upload + a rejection email in Mailpit. Set the QR in `/admin/settings`. (Note: the admin must have a recent sign-in for the step-up gate, and slip images load from Supabase storage — works against real `*.supabase.co`; locally the test-browser↔`:54321` hop may block image preview, same as Plan A.)
- [ ] **Step 3 (fixes):** commit `fix(pay): …`.

---

## After Plan B
The manual-PromptPay method is end-to-end: buyer pays + uploads slip → creator approves/rejects in admin → order confirmed/emailed. Remaining (later): localize the server-action error strings; FFP adapter (parked); pre-order (separate plan).
