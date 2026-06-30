'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { createDiscount, type DiscountInputRaw, updateDiscount } from '@/server/actions/discounts';

export interface DiscountFormValues {
  code: string;
  kind: 'fixed' | 'percent';
  value: string;
  minSubtotalThb: string;
  startsAt: string;
  endsAt: string;
  maxUses: string;
  active: boolean;
}

const EMPTY: DiscountFormValues = {
  code: '',
  kind: 'fixed',
  value: '',
  minSubtotalThb: '0',
  startsAt: '',
  endsAt: '',
  maxUses: '',
  active: true,
};

export function DiscountForm({
  mode,
  id,
  initial,
}: {
  mode: 'create' | 'edit';
  id?: string;
  initial?: DiscountFormValues;
}) {
  const router = useRouter();
  const t = useTranslations('admin.discounts');
  const tc = useTranslations('admin.common');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<DiscountFormValues>(initial ?? EMPTY);

  const set = <K extends keyof DiscountFormValues>(key: K, value: DiscountFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: DiscountInputRaw = {
      code: v.code,
      kind: v.kind,
      value: v.value,
      minSubtotalThb: v.minSubtotalThb,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      maxUses: v.maxUses.trim() === '' ? null : v.maxUses,
      active: v.active,
    };
    startTransition(async () => {
      const res =
        mode === 'edit' && id ? await updateDiscount(id, payload) : await createDiscount(payload);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      router.push('/admin/discounts');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="code">{t('labelCode')}</Label>
        <Input
          id="code"
          value={v.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
          placeholder="WELCOME50"
          required
          className="uppercase"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kind">{t('labelType')}</Label>
          <Select
            id="kind"
            value={v.kind}
            onChange={(e) => set('kind', e.target.value as 'fixed' | 'percent')}
          >
            <option value="fixed">{t('optionFixed')}</option>
            <option value="percent">{t('optionPercent')}</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="value">
            {v.kind === 'percent' ? t('labelPercentOff') : t('labelBahtOff')}
          </Label>
          <Input
            id="value"
            type="number"
            min={0}
            max={v.kind === 'percent' ? 100 : undefined}
            value={v.value}
            onChange={(e) => set('value', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="minSubtotal">{t('labelMinSubtotal')}</Label>
        <Input
          id="minSubtotal"
          type="number"
          min={0}
          value={v.minSubtotalThb}
          onChange={(e) => set('minSubtotalThb', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startsAt">{t('labelStarts')}</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={v.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt">{t('labelEnds')}</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            value={v.endsAt}
            onChange={(e) => set('endsAt', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxUses">{t('labelMaxUses')}</Label>
        <Input
          id="maxUses"
          type="number"
          min={1}
          value={v.maxUses}
          onChange={(e) => set('maxUses', e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={v.active}
          onChange={(e) => set('active', e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        {tc('active')}
      </label>

      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="solid" disabled={pending}>
          {pending ? tc('saving') : mode === 'edit' ? tc('saveChanges') : t('createCta')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/discounts')}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
