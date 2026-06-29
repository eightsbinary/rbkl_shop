'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { resendStepUpLink } from '@/server/actions/auth';

/** Shown when an admin action returns the step-up sentinel. Re-sends a magic
 *  link to the signed-in admin; clicking it refreshes last_sign_in_at so the
 *  retried action passes the recency gate. */
export function StepUpPrompt() {
  const t = useTranslations('admin.stepUp');
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <p>{t('prompt')}</p>
      {sent ? (
        <p className="text-success">{t('sent')}</p>
      ) : (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await resendStepUpLink();
              if ('error' in res) setError(res.error);
              else setSent(true);
            })
          }
        >
          {pending ? t('sending') : t('sendCta')}
        </Button>
      )}
      {error && <p className="text-error">{error}</p>}
    </div>
  );
}
