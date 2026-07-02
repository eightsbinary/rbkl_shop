'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { createBrowserSupabase } from '@/db/client';
import { submitSlip } from '@/server/actions/submit-slip';

export interface PaymentPanelProps {
  orderId: string;
  token: string;
  locale: 'th' | 'en';
  amountThb: number;
  status: string;
  qrUrl: string | null;
  accountLabel: string | null;
  instructions: { th?: string; en?: string };
}

export function PaymentPanel({
  orderId,
  token,
  locale,
  amountThb,
  status,
  qrUrl,
  accountLabel,
  instructions,
}: PaymentPanelProps) {
  const t = useTranslations('pay');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const signRes = await fetch('/api/storage/sign-slip-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, token, contentType: file.type, ext }),
      });
      if (!signRes.ok) {
        setError(t('error'));
        return;
      }
      const { token: slipToken, path } = (await signRes.json()) as {
        token: string;
        path: string;
      };
      const { error: upErr } = await createBrowserSupabase()
        .storage.from('payment-slips')
        .uploadToSignedUrl(path, slipToken, file, { contentType: file.type });
      if (upErr) {
        setError(t('error'));
        return;
      }
      const result = await submitSlip({ orderId, token, storagePath: path });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const uploaderLabel = status === 'awaiting_verification' ? t('reupload') : t('uploadLabel');
  const instruction = instructions[locale];

  return (
    <div className="border border-line bg-surface rounded-sm p-6 space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{t('title')}</p>
        <p className="font-serif text-2xl text-ink">
          {t('amount')}: ฿{amountThb.toLocaleString()}
        </p>
      </div>

      {status === 'awaiting_verification' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft leading-relaxed">{t('verifying')}</p>
          <FileUploader label={uploaderLabel} busy={busy} error={error} onFile={handleFile} />
        </div>
      )}

      {status !== 'awaiting_verification' && (
        <div className="space-y-4">
          {qrUrl ? (
            <div className="bg-field inline-block p-4">
              {/* biome-ignore lint/performance/noImgElement: QR is a user-uploaded image of
                  unknown host/size; next/image's remotePatterns coupling would crash the
                  order page for any Supabase host not pre-listed. */}
              <img
                src={qrUrl}
                alt="PromptPay QR"
                width={288}
                height={288}
                className="h-72 w-72 max-w-full object-contain"
              />
            </div>
          ) : (
            <p className="text-sm text-muted">{t('qrMissing')}</p>
          )}

          {accountLabel && <p className="text-sm font-medium text-ink">{accountLabel}</p>}

          {instruction && <p className="text-sm text-ink-soft leading-relaxed">{instruction}</p>}

          <p className="text-sm text-muted">{t('scanInstruction')}</p>

          <FileUploader label={uploaderLabel} busy={busy} error={error} onFile={handleFile} />
        </div>
      )}
    </div>
  );
}

function FileUploader({
  label,
  busy,
  error,
  onFile,
}: {
  label: string;
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
}) {
  const t = useTranslations('pay');

  return (
    <div className="space-y-2">
      <label htmlFor="slip-upload" className="block text-xs uppercase tracking-[0.15em] text-muted">
        {label}
      </label>
      <input
        id="slip-upload"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-none file:border-0 file:bg-ink file:px-4 file:py-2 file:text-paper hover:file:bg-ink-soft"
      />
      {busy && <p className="text-sm text-muted">{t('uploading')}</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
