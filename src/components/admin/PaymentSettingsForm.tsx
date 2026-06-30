'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { UploadField } from '@/components/admin/UploadField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { createBrowserSupabase } from '@/db/client';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { savePaymentSettings } from '@/server/actions/payment-settings';

interface Props {
  initialQrUrl: string | null;
  initialAccountLabel: string;
  initialInstructions: { th?: string; en?: string };
}

export function PaymentSettingsForm({
  initialQrUrl,
  initialAccountLabel,
  initialInstructions,
}: Props) {
  const t = useTranslations('admin.settings');
  const [pending, startTransition] = useTransition();

  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialQrUrl);
  const [uploading, setUploading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [accountLabel, setAccountLabel] = useState(initialAccountLabel);
  const [instructionsEn, setInstructionsEn] = useState(initialInstructions.en ?? '');
  const [instructionsTh, setInstructionsTh] = useState(initialInstructions.th ?? '');

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleQrFile(file: File) {
    setUploading(true);
    setUploadError(null);
    setJustUploaded(false);
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `qr/${Date.now()}.${ext}`;
      const signRes = await fetch('/api/storage/sign-asset-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!signRes.ok) throw new Error('sign-upload failed');
      const { token } = (await signRes.json()) as { token: string };
      const supa = createBrowserSupabase();
      const { error: upErr } = await supa.storage
        .from('payment-assets')
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supa.storage.from('payment-assets').getPublicUrl(path);
      setUploadedPath(path);
      setPreviewUrl(pub.publicUrl);
      setJustUploaded(true);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    setSaveError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await savePaymentSettings({
        promptpayQrPath: uploadedPath ?? undefined,
        accountLabel,
        instructions: {
          en: instructionsEn.trim() || undefined,
          th: instructionsTh.trim() || undefined,
        },
      });
      if ('error' in res) {
        setSaveError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      {/* QR upload */}
      <div className="space-y-3">
        <Label htmlFor="qr-upload">{t('qrLabel')}</Label>
        {previewUrl && (
          // biome-ignore lint/performance/noImgElement: QR preview; next/image not needed for admin-only upload
          <img
            src={previewUrl}
            alt="PromptPay QR"
            className="h-40 w-40 rounded-md border border-line object-contain"
          />
        )}
        <UploadField
          id="qr-upload"
          onFile={(f) => void handleQrFile(f)}
          disabled={uploading}
          dropHint={t('dropHint')}
        />
        <p className="text-xs text-muted">{t('uploadQr')}</p>
        {uploading && <p className="text-sm text-muted">{t('uploading')}</p>}
        {justUploaded && !uploading && <p className="text-sm text-success">{t('qrUploaded')}</p>}
        {uploadError && <p className="text-sm text-error">{uploadError}</p>}
      </div>

      {/* Account label */}
      <div className="space-y-1.5">
        <Label htmlFor="account-label">{t('accountLabel')}</Label>
        <Input
          id="account-label"
          value={accountLabel}
          onChange={(e) => setAccountLabel(e.target.value)}
          placeholder="rainbykello / 089-xxx-xxxx"
        />
      </div>

      {/* Instructions EN */}
      <div className="space-y-1.5">
        <Label htmlFor="instructions-en">{t('instructionsEn')}</Label>
        <Textarea
          id="instructions-en"
          value={instructionsEn}
          onChange={(e) => setInstructionsEn(e.target.value)}
          placeholder="Scan the QR code and transfer the exact amount…"
        />
      </div>

      {/* Instructions TH */}
      <div className="space-y-1.5">
        <Label htmlFor="instructions-th">{t('instructionsTh')}</Label>
        <Textarea
          id="instructions-th"
          value={instructionsTh}
          onChange={(e) => setInstructionsTh(e.target.value)}
          placeholder="สแกน QR และโอนยอดที่แสดง…"
        />
      </div>

      {/* Step-up / error / saved */}
      {saveError === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        saveError && <p className="text-sm text-error">{saveError}</p>
      )}
      {saved && <p className="text-sm text-success">{t('saved')}</p>}

      <Button variant="solid" disabled={pending || uploading} onClick={handleSave}>
        {pending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}
