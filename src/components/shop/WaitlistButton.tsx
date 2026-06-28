'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type State = 'idle' | 'pending' | 'done' | 'error';

export function WaitlistButton({ variantId }: { variantId: string | null }) {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [token, setToken] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!variantId) return;
    setState('pending');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantId, email, locale, turnstileToken: token }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p className="border border-line bg-field px-4 py-3 text-sm text-ink-soft">
        {t('notifyDone')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted">{t('outOfStock')}</p>
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('notifyEmailPlaceholder')}
        aria-label={t('notifyEmailPlaceholder')}
      />
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={state === 'pending' || !variantId}
      >
        {t('notifyMe')}
      </Button>
      <TurnstileWidget onToken={setToken} />
      {state === 'error' && <p className="text-sm text-error">{t('notifyError')}</p>}
    </form>
  );
}
