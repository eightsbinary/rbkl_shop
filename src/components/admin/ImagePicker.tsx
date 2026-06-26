'use client';

import { useState } from 'react';
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
      <Label htmlFor="image-upload">Add image</Label>
      <input
        id="image-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-4 file:py-2 file:text-paper hover:file:bg-ink-soft"
      />
      {busy && <p className="text-sm text-muted">Resizing and uploading…</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
