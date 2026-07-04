'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  lookupOrder,
  type RecoverResult,
  recoverOrders,
  type TrackResult,
} from '@/server/actions/track-order';

export default function TrackOrderPage() {
  const t = useTranslations('track');
  const locale = useLocale();
  const [token, setToken] = useState('');
  const [recoverMode, setRecoverMode] = useState(false);
  const [state, formAction, pending] = useActionState<TrackResult | null, FormData>(
    lookupOrder,
    null,
  );
  const [recoverState, recoverAction, recoverPending] = useActionState<
    RecoverResult | null,
    FormData
  >(recoverOrders, null);

  const activeError = recoverMode
    ? recoverState && 'error' in recoverState
      ? recoverState.error
      : null
    : (state?.error ?? null);
  const errorMsg =
    activeError === 'rateLimited'
      ? t('rateLimited')
      : activeError === 'verifyFailed'
        ? t('verifyFailed')
        : activeError
          ? t('notFound')
          : null;
  const recoverSent = recoverMode && recoverState && 'sent' in recoverState;

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <div className="border border-line bg-surface px-8 py-10">
          <header className="space-y-2 text-center">
            <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
            <p className="text-sm text-muted">
              {recoverMode ? t('recoverSubtitle') : t('subtitle')}
            </p>
          </header>

          {recoverSent ? (
            <p className="mt-8 border-l-2 border-success pl-3 text-sm text-ink-soft">
              {t('recoverSent')}
            </p>
          ) : (
            <form action={recoverMode ? recoverAction : formAction} className="mt-8 space-y-5">
              <input type="hidden" name="locale" value={locale} />
              {!recoverMode && (
                <div className="space-y-2">
                  <Label htmlFor="number" className="uppercase tracking-[0.12em]">
                    {t('numberLabel')}
                  </Label>
                  <Input id="number" name="number" required placeholder={t('numberPlaceholder')} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="uppercase tracking-[0.12em]">
                  {t('emailLabel')}
                </Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <TurnstileWidget onToken={setToken} />
              <input type="hidden" name="turnstileToken" value={token} />
              <Button
                type="submit"
                variant="solid"
                size="lg"
                disabled={pending || recoverPending}
                className="w-full"
              >
                {pending || recoverPending
                  ? t('submitting')
                  : recoverMode
                    ? t('recoverCta')
                    : t('cta')}
              </Button>
              {errorMsg && (
                <p className="border-l-2 border-error pl-3 text-sm text-error">{errorMsg}</p>
              )}
            </form>
          )}

          <button
            type="button"
            onClick={() => setRecoverMode(!recoverMode)}
            className="mt-6 w-full text-center text-sm text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            {recoverMode ? t('recoverBack') : t('recoverPrompt')}
          </button>
        </div>
      </div>
    </div>
  );
}
