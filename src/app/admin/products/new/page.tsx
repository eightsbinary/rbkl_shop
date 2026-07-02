import { getTranslations } from 'next-intl/server';
import { ProductForm } from '@/components/admin/ProductForm';

export default async function NewProductPage() {
  const t = await getTranslations('admin.products');

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">{t('newProduct')}</h1>
      <ProductForm initial={{}} />
    </div>
  );
}
