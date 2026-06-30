import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/Button';
import { createServerSupabase } from '@/db/server';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/15 text-success',
  draft: 'bg-warn/15 text-warn',
  archived: 'bg-muted/15 text-muted',
};

export default async function AdminProductsPage() {
  const supa = await createServerSupabase();
  const { data: products } = await supa
    .from('products')
    .select(
      'id, slug, status, name, base_price_thb, is_featured, hero_image:product_images!products_hero_image_fk(url_400)',
    )
    .order('updated_at', { ascending: false });

  const t = await getTranslations('admin.products');
  const tc = await getTranslations('admin.common');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
        <Link href="/admin/products/new">
          <Button variant="solid">{t('newProduct')}</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(products ?? []).map((p) => {
          const nameObj = p.name as { en?: string; th?: string };
          const name = nameObj.en ?? nameObj.th ?? p.slug;
          const hero = Array.isArray(p.hero_image) ? p.hero_image[0] : p.hero_image;
          const statusLabel =
            p.status === 'active'
              ? tc('active')
              : p.status === 'archived'
                ? tc('archived')
                : tc('draft');
          return (
            <Link
              key={p.id}
              href={`/admin/products/${p.id}/edit`}
              className="group block overflow-hidden border border-line bg-surface transition-colors duration-150 ease-out-soft hover:border-ink"
            >
              <div className="relative aspect-square bg-field">
                {hero?.url_400 ? (
                  // biome-ignore lint/performance/noImgElement: admin-only thumbnail, Next/Image not worth it
                  <img src={hero.url_400} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    {t('noImage')}
                  </div>
                )}
                {p.is_featured && (
                  <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-paper">
                    ★ {t('colFeatured')}
                  </span>
                )}
              </div>
              <div className="space-y-1.5 p-3">
                <p className="truncate text-sm text-ink group-hover:underline">{name}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">฿{p.base_price_thb.toLocaleString()}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      STATUS_BADGE[p.status] ?? 'bg-muted/15 text-muted'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
