'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { UploadField } from '@/components/admin/UploadField';
import { Button } from '@/components/ui/Button';
import { createBrowserSupabase } from '@/db/client';
import {
  ABOUT_IMAGE_SECTIONS,
  type AboutImageSection,
  DEFAULT_ABOUT_IMAGES,
} from '@/domain/about-content';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { saveAboutImages } from '@/server/actions/about';

interface Asset {
  path: string;
  url: string;
}

interface Props {
  /** Stored path per section (null → built-in default image). */
  initial: Record<AboutImageSection, string | null>;
  /** Previously uploaded images, newest first. */
  library: Asset[];
}

export function AboutImagesForm({ initial, library: initialLibrary }: Props) {
  const t = useTranslations('admin.about');
  const [pending, startTransition] = useTransition();

  const [library, setLibrary] = useState<Asset[]>(initialLibrary);
  const [selection, setSelection] = useState(initial);
  const [uploading, setUploading] = useState<AboutImageSection | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const urlFor = (section: AboutImageSection): string => {
    const path = selection[section];
    return (path && library.find((a) => a.path === path)?.url) || DEFAULT_ABOUT_IMAGES[section];
  };

  async function handleFile(section: AboutImageSection, file: File) {
    setUploading(section);
    setUploadError(null);
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `about/${section}-${Date.now()}.${ext}`;
      const signRes = await fetch('/api/storage/sign-asset-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!signRes.ok) throw new Error('sign-upload failed');
      const { token } = (await signRes.json()) as { token: string };
      const supa = createBrowserSupabase();
      const { error: upErr } = await supa.storage
        .from('about-assets')
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supa.storage.from('about-assets').getPublicUrl(path);
      setLibrary((lib) => [{ path, url: pub.publicUrl }, ...lib]);
      setSelection((s) => ({ ...s, [section]: path }));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  function handleSave() {
    setSaveError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveAboutImages(selection);
      if ('error' in res) {
        setSaveError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-10">
      {ABOUT_IMAGE_SECTIONS.map((section) => (
        <div key={section} className="space-y-3">
          <h3 className="font-serif text-lg text-ink">{t(`groups.${section}`)}</h3>

          {/* Current image */}
          {/* biome-ignore lint/performance/noImgElement: admin-only preview */}
          <img src={urlFor(section)} alt="" className="h-40 w-40 border border-line object-cover" />
          {selection[section] === null && (
            <p className="text-xs text-muted">{t('images.usingDefault')}</p>
          )}

          {/* Library picker */}
          {library.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {library.map((asset) => (
                <button
                  key={asset.path}
                  type="button"
                  onClick={() => setSelection((s) => ({ ...s, [section]: asset.path }))}
                  className={`border p-0.5 ${
                    selection[section] === asset.path ? 'border-ink' : 'border-line'
                  }`}
                  aria-pressed={selection[section] === asset.path}
                >
                  {/* biome-ignore lint/performance/noImgElement: admin-only thumbnail */}
                  <img src={asset.url} alt="" className="h-16 w-16 object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelection((s) => ({ ...s, [section]: null }))}
                className={`border px-3 text-xs text-muted ${
                  selection[section] === null ? 'border-ink' : 'border-line'
                }`}
              >
                {t('images.useDefault')}
              </button>
            </div>
          )}

          <UploadField
            id={`about-image-${section}`}
            onFile={(f) => void handleFile(section, f)}
            disabled={uploading !== null}
            dropHint={t('images.dropHint')}
          />
          {uploading === section && <p className="text-sm text-muted">{t('images.uploading')}</p>}
        </div>
      ))}

      {uploadError && <p className="text-sm text-error">{uploadError}</p>}
      {saveError === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        saveError && <p className="text-sm text-error">{saveError}</p>
      )}
      {saved && <p className="text-sm text-success">{t('saved')}</p>}

      <Button variant="solid" disabled={pending || uploading !== null} onClick={handleSave}>
        {pending ? t('saving') : t('images.save')}
      </Button>
    </div>
  );
}
