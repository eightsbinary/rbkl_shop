import type { ProductCardData } from '@/server/queries/products';
import { ProductCard } from './ProductCard';

export function ProductGrid({
  products,
  locale,
}: {
  products: ProductCardData[];
  locale: 'th' | 'en';
}) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} />
      ))}
    </div>
  );
}
