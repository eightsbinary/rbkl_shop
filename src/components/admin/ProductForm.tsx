'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { createBrowserSupabase } from '@/db/client';
import { generateVariants } from '@/domain/variant-matrix';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { type ProductInputT, saveProduct } from '@/server/actions/products';
import { ImagePicker, type UploadedImage } from './ImagePicker';

type ImageRow = { id: string; url_400: string; storage_path: string };

export type ProductFormInitial = Partial<ProductInputT> & {
  id?: string;
  imageRows?: ImageRow[];
  heroImageId?: string | null;
  preorderCounts?: Record<string, number>;
};

const DEFAULT_AXES: ProductInputT['axes'] = [
  { name: 'size', values: ['S', 'M', 'L', 'XL'] },
  { name: 'color', values: ['cream'] },
];

export function ProductForm({ initial }: { initial: ProductFormInitial }) {
  const router = useRouter();
  const t = useTranslations('admin.products');
  const tc = useTranslations('admin.common');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ProductInputT>({
    id: initial.id,
    slug: initial.slug,
    status: initial.status ?? 'draft',
    name: initial.name ?? { th: '', en: '' },
    description: initial.description ?? { th: '', en: '' },
    basePriceThb: initial.basePriceThb ?? 0,
    weightGrams: initial.weightGrams ?? 0,
    category: initial.category ?? '',
    isFeatured: initial.isFeatured ?? false,
    isPreorder: initial.isPreorder ?? false,
    preorderShipDate: initial.preorderShipDate ?? undefined,
    axes: initial.axes ?? DEFAULT_AXES,
    variantOverrides: initial.variantOverrides ?? [],
  });
  const preorderCounts = initial.preorderCounts ?? {};
  const [images, setImages] = useState<ImageRow[]>(initial.imageRows ?? []);
  const [heroImageId, setHeroImageId] = useState<string | null>(initial.heroImageId ?? null);
  // Raw text the user is typing for each axis' values, kept separate from the
  // parsed `axes[i].values` array so in-progress separators (the comma you just
  // typed, a trailing space) aren't stripped out from under the cursor.
  const [valuesText, setValuesText] = useState<string[]>(() =>
    (initial.axes ?? DEFAULT_AXES).map((a) => a.values.join(', ')),
  );

  function updateAxis(idx: number, patch: { name?: string; values?: string[] }) {
    setState((s) => ({
      ...s,
      axes: s.axes.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }

  function updateAxisValues(idx: number, text: string) {
    setValuesText((prev) => prev.map((v, i) => (i === idx ? text : v)));
    updateAxis(idx, {
      values: text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  function addAxis() {
    setState((s) => ({ ...s, axes: [...s.axes, { name: '', values: [] }] }));
    setValuesText((v) => [...v, '']);
  }

  function removeAxis(idx: number) {
    setState((s) => ({ ...s, axes: s.axes.filter((_, i) => i !== idx) }));
    setValuesText((v) => v.filter((_, i) => i !== idx));
  }

  function setOverride(
    optionValues: Record<string, string>,
    patch: { preorderEnabled?: boolean; preorderCap?: number | null },
  ) {
    setState((s) => {
      const i = s.variantOverrides.findIndex((o) =>
        Object.entries(optionValues).every(([k, v]) => o.optionValues[k] === v),
      );
      const base: ProductInputT['variantOverrides'][number] =
        i >= 0
          ? // biome-ignore lint/style/noNonNullAssertion: i >= 0 guarantees the element exists
            s.variantOverrides[i]!
          : {
              optionValues,
              priceThb: null,
              stockAvailable: 0,
              preorderEnabled: false,
              preorderCap: null,
            };
      // patch has optional keys; spread widens inferred type — cast back to the required element shape
      const next = { ...base, ...patch } as ProductInputT['variantOverrides'][number];
      const arr =
        i >= 0
          ? s.variantOverrides.map((o, j) => (j === i ? next : o))
          : [...s.variantOverrides, next];
      return { ...s, variantOverrides: arr };
    });
  }

  const findOv = (opts: Record<string, string>) =>
    state.variantOverrides.find((o) =>
      Object.entries(opts).every(([k, v]) => o.optionValues[k] === v),
    );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await saveProduct(state);
    setBusy(false);
    if ('error' in r && r.error) {
      setError(r.error);
      return;
    }
    router.push('/admin/products');
    router.refresh();
  }

  async function attachImage(productId: string, img: UploadedImage) {
    const supa = createBrowserSupabase();
    const { data, error: insErr } = await supa
      .from('product_images')
      .insert({
        product_id: productId,
        sort: images.length,
        storage_path: img.storage_path,
        url_400: img.url_400,
        url_800: img.url_800,
        url_1600: img.url_1600,
        alt: {},
      })
      .select('id, url_400, storage_path')
      .single();
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setImages((prev) => [...prev, data]);
    // First image becomes the storefront cover automatically.
    if (images.length === 0) {
      await supa.from('products').update({ hero_image_id: data.id }).eq('id', productId);
      setHeroImageId(data.id);
    }
  }

  async function setHero(productId: string, imageId: string) {
    const supa = createBrowserSupabase();
    const { error: e } = await supa
      .from('products')
      .update({ hero_image_id: imageId })
      .eq('id', productId);
    if (e) {
      setError(e.message);
      return;
    }
    setHeroImageId(imageId);
  }

  async function deleteImage(productId: string, image: ImageRow) {
    const supa = createBrowserSupabase();
    // Remove all three resized objects (best-effort) then the DB row.
    const paths = [400, 800, 1600].map((s) =>
      image.storage_path.replace('-400.webp', `-${s}.webp`),
    );
    await supa.storage.from('product-images').remove(paths);
    const { error: e } = await supa.from('product_images').delete().eq('id', image.id);
    if (e) {
      setError(e.message);
      return;
    }
    const remaining = images.filter((i) => i.id !== image.id);
    setImages(remaining);
    // If the cover was deleted, fall back to the first remaining image.
    if (heroImageId === image.id) {
      const nextHero = remaining[0]?.id ?? null;
      await supa.from('products').update({ hero_image_id: nextHero }).eq('id', productId);
      setHeroImageId(nextHero);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10 max-w-3xl">
      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-ink">{t('basics')}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name-th">{t('nameTh')}</Label>
            <Input
              id="name-th"
              value={state.name.th}
              onChange={(e) => setState({ ...state, name: { ...state.name, th: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name-en">{t('nameEn')}</Label>
            <Input
              id="name-en"
              value={state.name.en}
              onChange={(e) => setState({ ...state, name: { ...state.name, en: e.target.value } })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="desc-th">{t('descTh')}</Label>
            <Textarea
              id="desc-th"
              value={state.description.th}
              onChange={(e) =>
                setState({
                  ...state,
                  description: { ...state.description, th: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc-en">{t('descEn')}</Label>
            <Textarea
              id="desc-en"
              value={state.description.en}
              onChange={(e) =>
                setState({
                  ...state,
                  description: { ...state.description, en: e.target.value },
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2 max-w-xs">
          <Label htmlFor="category">{t('category')}</Label>
          <Input
            id="category"
            value={state.category ?? ''}
            onChange={(e) => setState({ ...state, category: e.target.value })}
            placeholder={t('categoryPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">{t('basePrice')}</Label>
            <Input
              id="price"
              type="number"
              min={0}
              value={state.basePriceThb}
              onChange={(e) => setState({ ...state, basePriceThb: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">{t('weight')}</Label>
            <Input
              id="weight"
              type="number"
              min={0}
              value={state.weightGrams}
              onChange={(e) => setState({ ...state, weightGrams: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">{tc('status')}</Label>
            <Select
              id="status"
              value={state.status}
              onChange={(e) =>
                setState({ ...state, status: e.target.value as ProductInputT['status'] })
              }
            >
              <option value="draft">{tc('draft')}</option>
              <option value="active">{tc('active')}</option>
              <option value="archived">{tc('archived')}</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isFeatured"
            type="checkbox"
            checked={state.isFeatured}
            onChange={(e) => setState({ ...state, isFeatured: e.target.checked })}
          />
          <Label htmlFor="isFeatured">{t('featureOnLanding')}</Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isPreorder"
            type="checkbox"
            checked={state.isPreorder ?? false}
            onChange={(e) => setState({ ...state, isPreorder: e.target.checked })}
          />
          <Label htmlFor="isPreorder">{t('preorderProduct')}</Label>
        </div>

        <div className="space-y-2 max-w-xs">
          <Label htmlFor="preorderShipDate">{t('preorderShipDate')}</Label>
          <DatePicker
            id="preorderShipDate"
            value={state.preorderShipDate ?? ''}
            onChange={(val) => setState({ ...state, preorderShipDate: val || undefined })}
          />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-ink">{t('variants')}</h2>
        <p className="text-xs text-muted">{t('variationsHint')}</p>
        {state.axes.map((axis, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: axes are user-mutated rows, name can repeat during edits
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor={`axis-name-${i}`}>{t('axisName')}</Label>
              <Input
                id={`axis-name-${i}`}
                value={axis.name}
                onChange={(e) => updateAxis(i, { name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`axis-values-${i}`}>{t('axisValues')}</Label>
              <Input
                id={`axis-values-${i}`}
                value={valuesText[i] ?? axis.values.join(', ')}
                onChange={(e) => updateAxisValues(i, e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => removeAxis(i)}
              className="h-11 px-2 text-sm text-error transition-colors hover:underline"
            >
              {t('removeVariation')}
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addAxis}>
          {t('addVariation')}
        </Button>

        {generateVariants(state.axes).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-ink">{t('preorderPerVariant')}</h3>
            <p className="text-xs text-muted">{t('preorderCapHint')}</p>
            {generateVariants(state.axes).map((d) => {
              const key = Object.values(d.optionValues).join(' / ');
              const ov = findOv(d.optionValues);
              const count = preorderCounts[JSON.stringify(d.optionValues)] ?? 0;
              return (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm"
                >
                  <span className="text-ink-soft">{key}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ov?.preorderEnabled ?? false}
                      onChange={(e) =>
                        setOverride(d.optionValues, { preorderEnabled: e.target.checked })
                      }
                    />
                    {t('preorderEnabled')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder={t('preorderCap')}
                    className="w-28"
                    value={ov?.preorderCap ?? ''}
                    onChange={(e) =>
                      setOverride(d.optionValues, {
                        preorderCap: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                  <span className="text-muted">
                    {t('preorderCount')}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl text-ink">{t('images')}</h2>
        {state.id ? (
          <>
            {images.length > 0 && (
              <>
                <p className="text-xs text-muted">{t('coverHint')}</p>
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                  {images.map((img) => {
                    const isHero = heroImageId === img.id;
                    return (
                      <div key={img.id} className="space-y-1.5">
                        <div className="relative">
                          {/* biome-ignore lint/performance/noImgElement: admin-only preview */}
                          <img
                            src={img.url_400}
                            alt=""
                            className={`aspect-square w-full rounded object-cover ${isHero ? 'ring-2 ring-ink ring-offset-2' : ''}`}
                          />
                          {isHero && (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-paper">
                              {t('coverImage')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          {isHero ? (
                            <span className="text-muted">{t('coverImage')}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => state.id && setHero(state.id, img.id)}
                              className="text-ink transition-colors hover:underline"
                            >
                              {t('setCover')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => state.id && deleteImage(state.id, img)}
                            className="text-error transition-colors hover:underline"
                          >
                            {t('deleteImage')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <ImagePicker
              productId={state.id}
              onUploaded={(img) => state.id && attachImage(state.id, img)}
            />
          </>
        ) : (
          <p className="text-sm text-muted">{t('saveFirstForImages')}</p>
        )}
      </section>

      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
      <div className="flex gap-3">
        <Button type="submit" variant="solid" disabled={busy}>
          {busy ? tc('saving') : state.id ? t('saveCta') : t('createCta')}
        </Button>
      </div>
    </form>
  );
}
