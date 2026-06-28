import type { ProductCardData } from '@/server/queries/products';
import { ProductCard } from './ProductCard';

/** Slot geometry from the Figma "Bento Grid Layout" (node 0:306): 12 cols, 24px gaps,
 *  two rows. Each slot fixes its image height to recreate the asymmetric rhythm. */
const SLOTS = [
  { col: 'lg:col-[1/span_8] lg:row-1', img: 'h-[420px] lg:h-[570px]' },
  { col: 'lg:col-[9/span_4] lg:row-1 lg:self-end', img: 'h-[300px] lg:h-[368px]' },
  { col: 'lg:col-[1/span_4] lg:row-2', img: 'h-[360px] lg:h-[490px]' },
  { col: 'lg:col-[5/span_8] lg:row-2', img: 'h-[280px] lg:h-[326px]' },
] as const;

export function FeaturedBento({
  products,
  locale,
}: {
  products: ProductCardData[];
  locale: 'th' | 'en';
}) {
  const items = products.slice(0, 4);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
      {items.map((p, i) => (
        <div key={p.id} className={SLOTS[i]?.col ?? ''}>
          <ProductCard product={p} locale={locale} imageClassName={SLOTS[i]?.img} />
        </div>
      ))}
    </div>
  );
}
