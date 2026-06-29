'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CARRIERS } from '@/domain/carriers';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { shipOrder } from '@/server/actions/ship-order';

const CARRIER_ENTRIES = Object.entries(CARRIERS).map(([key, c]) => ({ key, label: c.label }));

export function ShipOrderForm({ orderId }: { orderId: string }) {
  const t = useTranslations('admin.orders');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState(CARRIER_ENTRIES[0]?.key ?? '');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [eta, setEta] = useState('');
  const [notes, setNotes] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await shipOrder({
        orderId,
        carrier,
        trackingNumber: trackingNumber.trim(),
        estimatedDeliveryDate: eta || undefined,
        notesToBuyer: notes.trim() || undefined,
      });
      if (res && 'error' in res && res.error) setError(res.error);
      // On success the action revalidates this path; the page re-renders with
      // ship_status='shipped', which hides this form.
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="carrier">{t('ship.labelCarrier')}</Label>
          <Select id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            {CARRIER_ENTRIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tracking">{t('ship.labelTracking')}</Label>
          <Input
            id="tracking"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. TH123456789"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="eta">{t('ship.labelEta')}</Label>
        <Input id="eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t('ship.labelNotes')}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('ship.notesPlaceholder')}
          className="min-h-24"
        />
      </div>

      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}

      <Button type="submit" disabled={pending || trackingNumber.trim().length === 0}>
        {pending ? t('ship.marking') : t('ship.markShipped')}
      </Button>
    </form>
  );
}
