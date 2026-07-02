'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { cancelOrder } from '@/server/actions/cancel-order';

/** Two-step cancel for an unpaid order (shown on the order detail). On success
 *  the action revalidates and the page re-renders in the cancelled state. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations('admin.orders');
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function doCancel() {
    setError(null);
    start(async () => {
      const res = await cancelOrder(orderId);
      if (res && 'error' in res) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('cancelHint')}</p>
      {confirming ? (
        <div className="flex items-center gap-3">
          <Button type="button" variant="solid" size="sm" disabled={pending} onClick={doCancel}>
            {pending ? t('cancelling') : t('cancelConfirm')}
          </Button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            {t('cancelKeep')}
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
          {t('cancelOrder')}
        </Button>
      )}
      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
    </div>
  );
}
