'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { UploadField } from '@/components/admin/UploadField';
import { Label } from '@/components/ui/Label';
import { createBrowserSupabase } from '@/db/client';
import { IMAGE_SIZES, resizeImageToWebp } from '@/lib/images';

export interface UploadedImage {
  url_400: string;
  url_800: string;
  url_1600: string;
  storage_path: string;
}

export function ImagePicker({
  productId,
  onUploaded,
}: {
  productId: string;
  onUploaded: (img: UploadedImage) => void;
}) {
  const t = useTranslations('admin.products');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const supa = createBrowserSupabase();
      const stamp = Date.now();
      const urls: Partial<Record<number, string>> = {};
      let storagePath = '';
      for (const size of IMAGE_SIZES) {
        const blob = await resizeImageToWebp(file, size);
        const path = `products/${productId}/${stamp}-${size}.webp`;
        const signRes = await fetch('/api/storage/sign-upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        if (!signRes.ok) throw new Error('sign-upload failed');
        const { token } = (await signRes.json()) as { token: string };
        const { error: upErr } = await supa.storage
          .from('product-images')
          .uploadToSignedUrl(path, token, blob, { contentType: 'image/webp' });
        if (upErr) throw upErr;
        const { data: pub } = supa.storage.from('product-images').getPublicUrl(path);
        urls[size] = pub.publicUrl;
        if (size === IMAGE_SIZES[0]) storagePath = path;
      }
      onUploaded({
        url_400: urls[400] ?? '',
        url_800: urls[800] ?? '',
        url_1600: urls[1600] ?? '',
        storage_path: storagePath,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="image-upload">{t('addImage')}</Label>
      <UploadField
        id="image-upload"
        onFile={(f) => void handleFile(f)}
        disabled={busy}
        dropHint={t('dropHint')}
      />
      {busy && <p className="text-sm text-muted">{t('uploading')}</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
