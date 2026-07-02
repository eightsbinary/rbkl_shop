'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { DEFAULT_BG, type SiteAppearance } from '@/domain/site-appearance';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { saveSiteAppearance } from '@/server/actions/site-appearance';

/** Per-theme storefront background override. Null → the built-in palette. */
export function AppearanceForm({ initial }: { initial: SiteAppearance }) {
  const t = useTranslations('admin.settings');
  const [pending, startTransition] = useTransition();

  const [bgLight, setBgLight] = useState<string | null>(initial.bgLight);
  const [bgDark, setBgDark] = useState<string | null>(initial.bgDark);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const rows: Array<{
    key: 'light' | 'dark';
    label: string;
    value: string | null;
    set: (v: string | null) => void;
  }> = [
    { key: 'light', label: t('bgLight'), value: bgLight, set: setBgLight },
    { key: 'dark', label: t('bgDark'), value: bgDark, set: setBgDark },
  ];

  function handleSave() {
    setSaveError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveSiteAppearance({ bgLight, bgDark });
      if ('error' in res) {
        setSaveError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 border border-line p-4"
          >
            <label
              className="flex grow cursor-pointer items-center gap-3"
              htmlFor={`bg-${row.key}`}
            >
              <input
                id={`bg-${row.key}`}
                type="color"
                value={row.value ?? DEFAULT_BG[row.key]}
                onChange={(e) => row.set(e.target.value)}
                className="h-9 w-14 cursor-pointer border border-line bg-surface p-1"
              />
              <span className="space-y-1">
                <span className="block text-sm text-ink">{row.label}</span>
                <span className="block font-mono text-xs text-muted">
                  {row.value ?? `${DEFAULT_BG[row.key]} · ${t('bgDefault')}`}
                </span>
              </span>
            </label>
            {row.value && (
              <button
                type="button"
                onClick={() => row.set(null)}
                className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
              >
                {t('bgReset')}
              </button>
            )}
          </div>
        ))}
      </div>

      {saveError === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        saveError && <p className="text-sm text-error">{saveError}</p>
      )}
      {saved && <p className="text-sm text-success">{t('saved')}</p>}

      <Button variant="solid" disabled={pending} onClick={handleSave}>
        {pending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}
