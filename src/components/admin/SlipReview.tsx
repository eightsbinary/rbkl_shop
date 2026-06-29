'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { approveSlip, rejectSlip } from '@/server/actions/verify-slip';

export function SlipReview({ orderId, imageUrl }: { orderId: string; imageUrl: string | null }) {
  const t = useTranslations('admin.orders');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleResult(res: { ok: true } | { error: string }) {
    if ('error' in res) {
      if (res.error === STEP_UP_REQUIRED) setStepUp(true);
      else setError(res.error);
    } else {
      router.refresh();
    }
  }

  function onApprove() {
    setError(null);
    setStepUp(false);
    setActiveAction('approve');
    startTransition(async () => {
      const res = await approveSlip(orderId);
      handleResult(res);
      setActiveAction(null);
    });
  }

  function onReject() {
    setError(null);
    setStepUp(false);
    setActiveAction('reject');
    startTransition(async () => {
      const res = await rejectSlip(orderId, reason);
      handleResult(res);
      setActiveAction(null);
    });
  }

  return (
    <div className="mt-3 space-y-5 text-sm">
      <p className="text-ink-soft">{t('slipReceived')}</p>

      {imageUrl ? (
        <div className="space-y-2">
          <div className="max-w-sm overflow-hidden rounded bg-field p-2">
            {/* biome-ignore lint/performance/noImgElement: private signed URL, not next/image-optimizable */}
            <img src={imageUrl} alt="payment slip" className="w-full rounded" />
          </div>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted underline hover:text-ink"
          >
            {t('viewSlip')}
          </a>
        </div>
      ) : (
        <p className="text-muted">{t('noSlip')}</p>
      )}

      <div>
        <Button variant="solid" size="sm" disabled={pending} onClick={onApprove}>
          {pending && activeAction === 'approve' ? t('approving') : t('approve')}
        </Button>
      </div>

      <div className="space-y-2">
        <label className="block text-ink-soft">
          {t('rejectReasonLabel')}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded border border-line bg-field px-3 py-2 text-ink placeholder:text-muted"
          />
        </label>
        <Button variant="outline" size="sm" disabled={pending} onClick={onReject}>
          {pending && activeAction === 'reject' ? t('rejecting') : t('rejectConfirm')}
        </Button>
      </div>

      {stepUp && <StepUpPrompt />}
      {error && <p className="text-error">{error}</p>}
    </div>
  );
}
