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
      {products.map((p, i) => (
        // Staggered entrance: each card rises in 55ms after the previous one.
        <div
          key={p.id}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}
        >
          <ProductCard product={p} locale={locale} />
        </div>
      ))}
    </div>
  );
}
