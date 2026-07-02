'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { ABOUT_GROUPS, type AboutContent, type AboutField } from '@/domain/about-content';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { saveAboutContent } from '@/server/actions/about';

const LONG_FIELDS = new Set<AboutField>([
  'heroBody1',
  'heroBody2',
  'craftSubtitle',
  'card1Body',
  'card2Body',
  'inspirationBody1',
  'inspirationBody2',
]);

type Values = Record<AboutField, { th: string; en: string }>;

function Cell({
  long,
  value,
  onChange,
  placeholder,
}: {
  long: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return long ? (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-24"
    />
  ) : (
    <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  );
}

export function AboutContentForm({ initial }: { initial: Values }) {
  const t = useTranslations('admin.about');
  const [values, setValues] = useState<Values>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = (field: AboutField, lang: 'th' | 'en', val: string) =>
    setValues((v) => ({ ...v, [field]: { ...v[field], [lang]: val } }));

  function onSave() {
    setError(null);
    setSaved(false);
    start(async () => {
      const payload = values as AboutContent;
      const res = await saveAboutContent(payload);
      if ('error' in res) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-muted">{t('intro')}</p>

      {ABOUT_GROUPS.map((group) => (
        <section
          key={group.key}
          className="space-y-5 border-t border-line pt-8 first:border-0 first:pt-0"
        >
          <h2 className="font-serif text-xl text-ink">{t(`groups.${group.key}`)}</h2>
          {group.fields.map((field) => (
            <div key={field} className="space-y-2">
              <Label className="uppercase tracking-[0.12em]">{t(`fields.${field}`)}</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Cell
                  long={LONG_FIELDS.has(field)}
                  value={values[field].th}
                  onChange={(val) => update(field, 'th', val)}
                  placeholder={t('thLabel')}
                />
                <Cell
                  long={LONG_FIELDS.has(field)}
                  value={values[field].en}
                  onChange={(val) => update(field, 'en', val)}
                  placeholder={t('enLabel')}
                />
              </div>
            </div>
          ))}
        </section>
      ))}

      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
      {saved && <p className="text-sm text-success">{t('saved')}</p>}

      <Button type="button" variant="solid" disabled={pending} onClick={onSave}>
        {pending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}
