'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { useCart } from '@/lib/cart-store';
import { placeOrder } from '@/server/actions/orders';
import type { CartPreviewLine } from '@/server/queries/cart';
import { OrderSummary, type SummaryNumbers } from './OrderSummary';

interface Zone {
  code: string;
  flatRateThb: number;
  countries: string[];
}

export function CheckoutForm({ zones }: { zones: Zone[] }) {
  const t = useTranslations('checkout');
  const locale = useLocale() as 'th' | 'en';
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);

  const [preview, setPreview] = useState<CartPreviewLine[]>([]);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    country: 'TH',
    phone: '',
    discountCode: '',
  });

  useEffect(() => {
    if (lines.length === 0) return;
    fetch('/api/cart/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: lines.map((l) => l.variantId) }),
    })
      .then((r) => r.json() as Promise<CartPreviewLine[]>)
      .then(setPreview)
      .catch(() => setPreview([]));
  }, [lines]);

  const numbers: SummaryNumbers = useMemo(() => {
    const subtotal = lines.reduce((acc, l) => {
      const p = preview.find((x) => x.variantId === l.variantId);
      return acc + (p?.unitPriceThb ?? 0) * l.qty;
    }, 0);
    const zone =
      zones.find((z) => z.countries.includes(form.country)) ??
      zones.find((z) => z.countries.includes('*'));
    const shipping = zone?.flatRateThb ?? 0;
    return { subtotal, discount: 0, shipping, total: subtotal + shipping };
  }, [lines, preview, form.country, zones]);

  if (lines.length === 0) {
    return <p className="text-muted">{t('summary')}: 0</p>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await placeOrder({
      email: form.email,
      locale,
      address: {
        fullName: form.fullName,
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        postalCode: form.postalCode,
        country: form.country,
        phone: form.phone || undefined,
      },
      lines: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
      discountCode: form.discountCode || undefined,
      turnstileToken: token,
    });
    setBusy(false);
    if (!('ok' in r)) {
      setError(r.error);
      return;
    }
    clearCart();
    router.push(`/${locale}${r.redirectUrl ?? `/order/${r.orderId}?t=${r.token}`}`);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={onSubmit} className="space-y-10">
        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-ink">{t('contact')}</h2>
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-ink">{t('shipping')}</h2>
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('fullName')}</Label>
            <Input
              id="fullName"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line1">{t('line1')}</Label>
            <Input
              id="line1"
              required
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line2">{t('line2')}</Label>
            <Input
              id="line2"
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t('city')}</Label>
              <Input
                id="city"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t('postalCode')}</Label>
              <Input
                id="postalCode"
                required
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">{t('country')}</Label>
              <Select
                id="country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                <option value="TH">Thailand (TH)</option>
                <option value="SG">Singapore (SG)</option>
                <option value="MY">Malaysia (MY)</option>
                <option value="ID">Indonesia (ID)</option>
                <option value="VN">Vietnam (VN)</option>
                <option value="PH">Philippines (PH)</option>
                <option value="US">United States (US)</option>
                <option value="JP">Japan (JP)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="AU">Australia (AU)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discountCode">{t('discountCode')}</Label>
            <Input
              id="discountCode"
              value={form.discountCode}
              onChange={(e) => setForm({ ...form, discountCode: e.target.value })}
            />
          </div>
        </section>

        {error && <p className="text-sm text-error">{error}</p>}

        <TurnstileWidget onToken={setToken} />

        <Button type="submit" size="lg" disabled={busy} className="w-full lg:w-auto">
          {busy ? '…' : t('placeOrder')}
        </Button>
      </form>

      <OrderSummary lines={lines} preview={preview} numbers={numbers} />
    </div>
  );
}
