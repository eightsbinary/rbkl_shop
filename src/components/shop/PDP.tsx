import Image from 'next/image';
import type { ProductDetailData } from '@/server/queries/products';
import { BuyPanel } from './BuyPanel';

function imgAlt(img: { alt: unknown }, locale: 'th' | 'en', fallback: string): string {
  const a = img.alt as { th?: string; en?: string } | null;
  return a?.[locale] ?? a?.en ?? fallback;
}

export interface AccordionCopy {
  detailsTitle: string;
  detailsBody: string;
  shippingTitle: string;
  shippingBody: string;
}

export function PDP({
  data,
  locale,
  accordions,
}: {
  data: ProductDetailData;
  locale: 'th' | 'en';
  accordions?: AccordionCopy;
}) {
  const nameObj = data.product.name as { th?: string; en?: string };
  const descObj = data.product.description as { th?: string; en?: string };
  const name = nameObj[locale] ?? nameObj.en ?? nameObj.th ?? data.product.slug;
  const desc = descObj[locale] ?? descObj.en ?? '';
  const [main, ...rest] = data.images;
  const details = rest.slice(0, 2);

  return (
    <article className="container mx-auto px-6 py-16 lg:px-16">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-7">
          {main ? (
            <div className="aspect-[4/5] w-full overflow-hidden bg-field">
              <Image
                src={main.url_1600}
                alt={imgAlt(main, locale, name)}
                width={1600}
                height={2000}
                priority
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[4/5] w-full bg-field" />
          )}
          {details.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {details.map((img) => (
                <div key={img.id} className="aspect-square w-full overflow-hidden bg-field">
                  <Image
                    src={img.url_800}
                    alt={imgAlt(img, locale, name)}
                    width={800}
                    height={800}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <BuyPanel
            name={name}
            description={desc}
            category={data.product.category}
            options={data.options}
            variants={data.variants}
            basePriceThb={data.product.base_price_thb}
            isPreorder={data.product.is_preorder}
            preorderShipDate={data.product.preorder_ship_date}
            accordions={accordions}
          />
        </div>
      </div>
    </article>
  );
}
