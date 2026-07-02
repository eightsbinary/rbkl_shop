'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/routing';

/** Editorial "Journal" band. Captures the email via POST /api/newsletter
 *  (single opt-in) and shows a thank-you. */
export function NewsletterBand({
  locale,
  title,
  subtitle,
  placeholder,
  cta,
  thanks,
  error,
}: {
  locale: Locale;
  title: string;
  subtitle: string;
  placeholder: string;
  cta: string;
  thanks: string;
  error: string;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('pending');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, locale, source: 'home_band' }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="bg-ink-deep px-6 py-24 text-center text-paper-fixed">
      <div className="mx-auto max-w-xl space-y-5">
        <h2 className="font-serif text-3xl">{title}</h2>
        <p className="text-sm text-paper-fixed/70">{subtitle}</p>
        {status === 'done' ? (
          <p className="text-sm text-paper-fixed/90">{thanks}</p>
        ) : (
          <form className="flex flex-col items-center gap-3" onSubmit={onSubmit}>
            <div className="flex items-center justify-center gap-0">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                disabled={status === 'pending'}
                className="h-12 w-64 border border-paper-fixed/30 bg-transparent px-4 text-sm text-paper-fixed placeholder:text-paper-fixed/40 focus:border-paper-fixed focus:outline-none"
              />
              <Button type="submit" variant="solid-paper" size="md" disabled={status === 'pending'}>
                {cta}
              </Button>
            </div>
            {status === 'error' && (
              <p role="alert" className="text-sm text-paper-fixed/80">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
