'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { StepUpPrompt } from '@/components/admin/StepUpPrompt';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { createBrowserSupabase } from '@/db/client';
import { STEP_UP_REQUIRED } from '@/lib/step-up';
import { type ProductInputT, saveProduct } from '@/server/actions/products';
import { ImagePicker, type UploadedImage } from './ImagePicker';

export type ProductFormInitial = Partial<ProductInputT> & {
  id?: string;
  imageRows?: { id: string; url_400: string }[];
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
    axes: initial.axes ?? DEFAULT_AXES,
    variantOverrides: initial.variantOverrides ?? [],
  });
  const [images, setImages] = useState(initial.imageRows ?? []);

  function updateAxis(idx: number, patch: { name?: string; values?: string[] }) {
    setState((s) => ({
      ...s,
      axes: s.axes.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }

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
      .select('id, url_400')
      .single();
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setImages((prev) => [...prev, data]);
    if (images.length === 0) {
      await supa.from('products').update({ hero_image_id: data.id }).eq('id', productId);
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
      </section>

      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-ink">{t('variants')}</h2>
        {state.axes.map((axis, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: axes are user-mutated rows, name can repeat during edits
          <div key={i} className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`axis-name-${i}`}>{t('axisName')}</Label>
              <Input
                id={`axis-name-${i}`}
                value={axis.name}
                onChange={(e) => updateAxis(i, { name: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor={`axis-values-${i}`}>{t('axisValues')}</Label>
              <Input
                id={`axis-values-${i}`}
                value={axis.values.join(', ')}
                onChange={(e) =>
                  updateAxis(i, {
                    values: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>
        ))}
      </section>

      {state.id && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-ink">{t('images')}</h2>
          <div className="grid grid-cols-4 gap-3">
            {images.map((img) => (
              // biome-ignore lint/performance/noImgElement: admin-only preview, sizes vary, Next/Image not worth it
              <img
                key={img.id}
                src={img.url_400}
                alt=""
                className="aspect-square w-full rounded object-cover"
              />
            ))}
          </div>
          <ImagePicker
            productId={state.id}
            onUploaded={(img) => state.id && attachImage(state.id, img)}
          />
        </section>
      )}

      {error === STEP_UP_REQUIRED ? (
        <StepUpPrompt />
      ) : (
        error && <p className="text-sm text-error">{error}</p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? tc('saving') : state.id ? t('saveCta') : t('createCta')}
        </Button>
      </div>
    </form>
  );
}
