'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { requestMagicLink } from '@/server/actions/auth';

type Status = 'idle' | 'sent' | { error: string };

export default function AdminLoginPage() {
  const t = useTranslations('admin.login');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [token, setToken] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="block text-center font-serif text-2xl tracking-tight text-ink transition-colors hover:text-ink-soft"
        >
          rainbykello
        </Link>

        <div className="mt-10 border border-line bg-surface px-8 py-10">
          <header className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{t('badge')}</p>
            <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </header>

          <form
            action={async (fd) => {
              setSubmitting(true);
              const r = await requestMagicLink(fd);
              setSubmitting(false);
              if ('ok' in r) setStatus('sent');
              else setStatus({ error: r.error });
            }}
            className="mt-8 space-y-5"
          >
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
              disabled={submitting}
              className="w-full"
            >
              {submitting ? t('sending') : t('sendCta')}
            </Button>
            {status === 'sent' && (
              <p className="border-l-2 border-success pl-3 text-sm text-success">
                {t('sentMsg')}
                {/* NODE_ENV is inlined at build time — the Mailpit hint only ships in dev builds. */}
                {process.env.NODE_ENV === 'development' && (
                  <span className="mt-1 block text-xs text-muted">{t('sentMsgDev')}</span>
                )}
              </p>
            )}
            {typeof status === 'object' && 'error' in status && (
              <p className="border-l-2 border-error pl-3 text-sm text-error">{status.error}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
