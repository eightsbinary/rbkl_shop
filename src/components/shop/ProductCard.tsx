import Image from 'next/image';
import Link from 'next/link';
import type { ProductCardData } from '@/server/queries/products';

export function ProductCard({
  product,
  locale,
}: {
  product: ProductCardData;
  locale: 'th' | 'en';
}) {
  const name = product.name[locale] ?? product.name.en ?? product.name.th ?? product.slug;
  const altObj = product.heroImage?.alt as { th?: string; en?: string } | undefined;
  const alt = altObj?.[locale] ?? altObj?.en ?? name;

  return (
    <Link
      href={`/${locale}/product/${product.slug}`}
      className="group block space-y-3 transition-transform duration-220 ease-out-soft hover:-translate-y-1"
    >
      <div className="aspect-square overflow-hidden rounded-md bg-paper-warm shadow-sm transition-shadow duration-220 ease-out-soft group-hover:shadow-lg">
        {product.heroImage ? (
          <Image
            src={product.heroImage.url_800}
            alt={alt}
            width={800}
            height={800}
            className="h-full w-full object-cover transition-transform duration-300 ease-out-soft group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-line" />
        )}
      </div>
      <div className="space-y-1">
        <p className="font-serif text-lg text-ink">{name}</p>
        <p className="text-sm text-muted">฿{product.basePriceThb.toLocaleString()}</p>
      </div>
    </Link>
  );
}
