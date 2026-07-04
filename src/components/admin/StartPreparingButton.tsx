'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { startPreparing } from '@/server/actions/prepare-order';

/** Shown on awaiting_stock orders: marks pre-order stock as arrived, moving the
 *  order to preparing and emailing the buyer. Page re-renders on success. */
export function StartPreparingButton({ orderId }: { orderId: string }) {
  const t = useTranslations('admin.orders');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function doStart() {
    setError(null);
    start(async () => {
      const res = await startPreparing(orderId);
      if (res && 'error' in res) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t('startPreparingHint')}</p>
      <Button type="button" variant="solid" size="sm" disabled={pending} onClick={doStart}>
        {pending ? t('startPreparingBusy') : t('startPreparing')}
      </Button>
      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
    </div>
  );
}
