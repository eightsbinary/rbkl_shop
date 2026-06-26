import Image from 'next/image';
import type { ProductDetailData } from '@/server/queries/products';
import { VariantSelector } from './VariantSelector';

export function PDP({ data, locale }: { data: ProductDetailData; locale: 'th' | 'en' }) {
  const nameObj = data.product.name as { th?: string; en?: string };
  const descObj = data.product.description as { th?: string; en?: string };
  const name = nameObj[locale] ?? nameObj.en ?? nameObj.th ?? data.product.slug;
  const desc = descObj[locale] ?? descObj.en ?? '';

  return (
    <article className="container mx-auto px-6 py-16">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="space-y-4">
          {data.images.length > 0 ? (
            data.images.map((img) => {
              const altObj = img.alt as { th?: string; en?: string };
              return (
                <Image
                  key={img.id}
                  src={img.url_1600}
                  alt={altObj?.[locale] ?? altObj?.en ?? name}
                  width={1600}
                  height={1600}
                  className="w-full rounded-md bg-paper-warm object-cover"
                />
              );
            })
          ) : (
            <div className="aspect-square w-full rounded-md bg-line" />
          )}
        </div>
        <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <header className="space-y-3">
            <h1 className="font-serif text-4xl text-ink">{name}</h1>
            {desc && <p className="whitespace-pre-line text-ink-soft leading-relaxed">{desc}</p>}
          </header>
          <VariantSelector
            options={data.options}
            variants={data.variants}
            basePriceThb={data.product.base_price_thb}
          />
        </div>
      </div>
    </article>
  );
}
