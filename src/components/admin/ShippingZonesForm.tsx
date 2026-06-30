'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { saveShippingZones } from '@/server/actions/shipping';
import type { AdminShippingZone } from '@/server/queries/shipping';

interface Row {
  key: string;
  id?: string;
  code: string;
  nameEn: string;
  nameTh: string;
  countriesText: string;
  flatRateThb: number;
  isActive: boolean;
}

let counter = 0;

function toRow(z: AdminShippingZone): Row {
  return {
    key: z.id,
    id: z.id,
    code: z.code,
    nameEn: z.name.en ?? '',
    nameTh: z.name.th ?? '',
    countriesText: z.countries.join(', '),
    flatRateThb: z.flatRateThb,
    isActive: z.isActive,
  };
}

export function ShippingZonesForm({ initial }: { initial: AdminShippingZone[] }) {
  const t = useTranslations('admin.shipping');
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        key: `new-${counter++}`,
        code: '',
        nameEn: '',
        nameTh: '',
        countriesText: '',
        flatRateThb: 0,
        isActive: true,
      },
    ]);
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  function onSave() {
    setError(null);
    setSaved(false);
    start(async () => {
      const payload = rows.map((r) => ({
        id: r.id,
        code: r.code.trim(),
        name: { en: r.nameEn.trim() || undefined, th: r.nameTh.trim() || undefined },
        countries: r.countriesText
          .split(',')
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        flatRateThb: Number(r.flatRateThb) || 0,
        isActive: r.isActive,
      }));
      const res = await saveShippingZones(payload);
      if ('error' in res) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('sectionHint')}</p>
      {rows.length === 0 && <p className="text-sm text-muted">{t('empty')}</p>}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="space-y-3 border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="uppercase tracking-[0.12em]">{t('code')}</Label>
                <Input
                  value={r.code}
                  onChange={(e) => update(r.key, { code: e.target.value })}
                  placeholder="TH"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="uppercase tracking-[0.12em]">{t('nameEn')}</Label>
                <Input
                  value={r.nameEn}
                  onChange={(e) => update(r.key, { nameEn: e.target.value })}
                  placeholder="Thailand"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="uppercase tracking-[0.12em]">{t('nameTh')}</Label>
                <Input
                  value={r.nameTh}
                  onChange={(e) => update(r.key, { nameTh: e.target.value })}
                  placeholder="ไทย"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-1.5">
                <Label className="uppercase tracking-[0.12em]">{t('countries')}</Label>
                <Input
                  value={r.countriesText}
                  onChange={(e) => update(r.key, { countriesText: e.target.value })}
                  placeholder="TH    ·    *"
                />
                <p className="text-xs text-muted">{t('countriesHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="uppercase tracking-[0.12em]">{t('rate')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={r.flatRateThb}
                  onChange={(e) => update(r.key, { flatRateThb: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={r.isActive}
                  onChange={(e) => update(r.key, { isActive: e.target.checked })}
                />
                {t('active')}
              </label>
              <button
                type="button"
                onClick={() => removeRow(r.key)}
                className="text-sm text-error transition-colors hover:underline"
              >
                {t('remove')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        {t('addZone')}
      </Button>

      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
      {saved && <p className="text-sm text-success">{t('saved')}</p>}

      <div>
        <Button type="button" variant="solid" disabled={pending} onClick={onSave}>
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
