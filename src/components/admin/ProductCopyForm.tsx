'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import {
  PRODUCT_COPY_FIELDS,
  type ProductCopy,
  type ProductCopyField,
} from '@/domain/product-copy';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { saveProductCopy } from '@/server/actions/product-copy';

const LONG_FIELDS = new Set<ProductCopyField>(['detailsBody', 'shippingBody']);

type Values = Record<ProductCopyField, { th: string; en: string }>;

export function ProductCopyForm({ initial }: { initial: Values }) {
  const t = useTranslations('admin.productCopy');
  const [values, setValues] = useState<Values>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = (field: ProductCopyField, lang: 'th' | 'en', val: string) =>
    setValues((v) => ({ ...v, [field]: { ...v[field], [lang]: val } }));

  function onSave() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await saveProductCopy(values as ProductCopy);
      if ('error' in res) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      {PRODUCT_COPY_FIELDS.map((field) => (
        <div key={field} className="space-y-2">
          <Label className="uppercase tracking-[0.12em]">{t(`fields.${field}`)}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['th', 'en'] as const).map((lang) =>
              LONG_FIELDS.has(field) ? (
                <Textarea
                  key={lang}
                  value={values[field][lang]}
                  onChange={(e) => update(field, lang, e.target.value)}
                  placeholder={t(`${lang}Label`)}
                  className="min-h-24"
                />
              ) : (
                <Input
                  key={lang}
                  value={values[field][lang]}
                  onChange={(e) => update(field, lang, e.target.value)}
                  placeholder={t(`${lang}Label`)}
                />
              ),
            )}
          </div>
        </div>
      ))}

      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
      {saved && <p className="text-sm text-success">{t('saved')}</p>}

      <Button variant="solid" disabled={pending} onClick={onSave}>
        {pending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}
