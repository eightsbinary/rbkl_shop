import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/Button';
import { createServerSupabase } from '@/db/server';

export default async function AdminProductsPage() {
  const supa = await createServerSupabase();
  const { data: products } = await supa
    .from('products')
    .select('id, slug, status, name, base_price_thb, is_featured, updated_at')
    .order('updated_at', { ascending: false });

  const t = await getTranslations('admin.products');
  const tc = await getTranslations('admin.common');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
        <Link href="/admin/products/new">
          <Button>{t('newProduct')}</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-line bg-paper">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('colName')}</th>
              <th className="px-4 py-3 font-medium">{tc('status')}</th>
              <th className="px-4 py-3 font-medium">{t('colFeatured')}</th>
              <th className="px-4 py-3 font-medium">{t('colPrice')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => {
              const nameObj = p.name as { en?: string; th?: string };
              const name = nameObj.en ?? nameObj.th ?? p.slug;
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{name}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.status}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.is_featured ? '✓' : ''}</td>
                  <td className="px-4 py-3 text-ink-soft">฿{p.base_price_thb.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="text-rose-deep hover:underline"
                    >
                      {t('editLink')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
