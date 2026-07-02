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
import {
  DEFAULT_HOME_HERO_IMAGE,
  HOME_FIELDS,
  type HomeContent,
  type HomeField,
} from '@/domain/home-content';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { saveHomeHero } from '@/server/actions/home';

interface Asset {
  path: string;
  url: string;
}

interface Props {
  /** Effective values to pre-fill (stored override, else the i18n default). */
  initial: Record<HomeField, { th: string; en: string }>;
  /** Stored image path (null → built-in /hero.png). */
  initialImagePath: string | null;
  /** Previously uploaded hero images, newest first. */
  library: Asset[];
}

export function HomeHeroForm({ initial, initialImagePath, library: initialLibrary }: Props) {
  const t = useTranslations('admin.home');
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState(initial);
  const [library, setLibrary] = useState<Asset[]>(initialLibrary);
  const [imagePath, setImagePath] = useState<string | null>(initialImagePath);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const previewUrl =
    (imagePath && library.find((a) => a.path === imagePath)?.url) || DEFAULT_HOME_HERO_IMAGE;

  const update = (field: HomeField, lang: 'th' | 'en', val: string) =>
    setValues((v) => ({ ...v, [field]: { ...v[field], [lang]: val } }));

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `home/hero-${Date.now()}.${ext}`;
      const signRes = await fetch('/api/storage/sign-asset-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!signRes.ok) throw new Error('sign-upload failed');
      const { token } = (await signRes.json()) as { token: string };
      const supa = createBrowserSupabase();
      const { error: upErr } = await supa.storage
        .from('home-assets')
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supa.storage.from('home-assets').getPublicUrl(path);
      setLibrary((lib) => [{ path, url: pub.publicUrl }, ...lib]);
      setImagePath(path);
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
      const res = await saveHomeHero({ content: values as HomeContent, image: imagePath });
      if ('error' in res) {
        setSaveError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-muted">{t('intro')}</p>

      {/* Text fields */}
      <section className="space-y-5">
        {HOME_FIELDS.map((field) => (
          <div key={field} className="space-y-2">
            <Label className="uppercase tracking-[0.12em]">{t(`fields.${field}`)}</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['th', 'en'] as const).map((lang) =>
                field === 'heroSubtitle' ? (
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
      </section>

      {/* Hero image */}
      <section className="space-y-3 border-t border-line pt-8">
        <h2 className="font-serif text-xl text-ink">{t('imageHeading')}</h2>
        {/* biome-ignore lint/performance/noImgElement: admin-only preview */}
        <img src={previewUrl} alt="" className="h-56 w-40 border border-line object-cover" />
        {imagePath === null && <p className="text-xs text-muted">{t('usingDefault')}</p>}

        {library.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {library.map((asset) => (
              <button
                key={asset.path}
                type="button"
                onClick={() => setImagePath(asset.path)}
                className={`border p-0.5 ${imagePath === asset.path ? 'border-ink' : 'border-line'}`}
                aria-pressed={imagePath === asset.path}
              >
                {/* biome-ignore lint/performance/noImgElement: admin-only thumbnail */}
                <img src={asset.url} alt="" className="h-16 w-16 object-cover" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setImagePath(null)}
              className={`border px-3 text-xs text-muted ${
                imagePath === null ? 'border-ink' : 'border-line'
              }`}
            >
              {t('useDefault')}
            </button>
          </div>
        )}

        <UploadField
          id="home-hero-image"
          onFile={(f) => void handleFile(f)}
          disabled={uploading}
          dropHint={t('dropHint')}
        />
        {uploading && <p className="text-sm text-muted">{t('uploading')}</p>}
        {uploadError && <p className="text-sm text-error">{uploadError}</p>}
      </section>

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
