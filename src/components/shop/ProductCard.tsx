import Image from 'next/image';
import Link from 'next/link';
import type { ProductCardData } from '@/server/queries/products';

export function ProductCard({
  product,
  locale,
  imageClassName = 'aspect-square',
}: {
  product: ProductCardData;
  locale: 'th' | 'en';
  imageClassName?: string;
}) {
  const name = product.name[locale] ?? product.name.en ?? product.name.th ?? product.slug;
  const altObj = product.heroImage?.alt as { th?: string; en?: string } | undefined;
  const alt = altObj?.[locale] ?? altObj?.en ?? name;

  return (
    <Link href={`/${locale}/product/${product.slug}`} className="group block space-y-4">
      <div className={`overflow-hidden bg-field ${imageClassName}`}>
        {product.heroImage ? (
          <Image
            src={product.heroImage.url_800}
            alt={alt}
            width={800}
            height={800}
            className="h-full w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-field" />
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-serif text-2xl leading-8 text-ink">{name}</p>
          {product.category && <p className="text-base text-muted">{product.category}</p>}
        </div>
        <p className="shrink-0 text-base text-ink">฿{product.basePriceThb.toLocaleString()}</p>
      </div>
    </Link>
  );
}
