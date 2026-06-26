'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { simulateMockPayment } from '@/server/actions/mock-payment';

export default function MockPayPage({
  params,
}: {
  params: Promise<{ locale: 'th' | 'en'; order: string }>;
}) {
  const { locale, order } = use(params);
  const router = useRouter();
  const [busy, setBusy] = useState<'paid' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(status: 'paid' | 'failed') {
    setBusy(status);
    setError(null);
    const r = await simulateMockPayment(order, status);
    if (!('ok' in r)) {
      setError(r.error);
      setBusy(null);
      return;
    }
    router.push(`/${r.locale ?? locale}/order/${order}?t=${r.token}`);
  }

  return (
    <section className="container mx-auto max-w-md px-6 py-24 space-y-8 text-center">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">mock payment</p>
        <h1 className="font-serif text-3xl text-ink">Simulate the result</h1>
        <p className="text-ink-soft text-sm">Dev-only screen. Real PSP integration in Plan 6.</p>
      </header>
      <div className="space-y-3">
        <Button
          size="lg"
          variant="primary"
          disabled={busy !== null}
          onClick={() => simulate('paid')}
          className="w-full"
        >
          {busy === 'paid' ? '…' : 'Simulate successful payment'}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => simulate('failed')}
          className="w-full"
        >
          {busy === 'failed' ? '…' : 'Simulate failed payment'}
        </Button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </section>
  );
}
