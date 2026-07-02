'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { saveEmailProvider } from '@/server/actions/app-settings';
import type { EmailProvider } from '@/server/queries/app-settings';

interface Props {
  initialProvider: EmailProvider;
}

export function EmailProviderForm({ initialProvider }: Props) {
  const t = useTranslations('admin.settings');
  const [pending, startTransition] = useTransition();

  const [provider, setProvider] = useState<EmailProvider>(initialProvider);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const options: Array<{ value: EmailProvider; label: string; hint: string }> = [
    { value: 'gmail', label: t('providerGmail'), hint: t('providerGmailHint') },
    { value: 'resend', label: t('providerResend'), hint: t('providerResendHint') },
  ];

  function handleSave() {
    setSaveError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveEmailProvider(provider);
      if ('error' in res) {
        setSaveError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="sr-only">{t('emailProviderLabel')}</legend>
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-3 border border-line p-4 has-[:checked]:border-ink"
          >
            <input
              type="radio"
              name="email-provider"
              value={opt.value}
              checked={provider === opt.value}
              onChange={() => setProvider(opt.value)}
              className="mt-1 accent-ink"
            />
            <span className="space-y-1">
              <span className="block text-sm text-ink">{opt.label}</span>
              <span className="block text-xs text-muted">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

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
