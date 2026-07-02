'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CartLine } from '@/lib/cart-store';
import type { CartPreviewLine } from '@/server/queries/cart';

export function CartLineItem({
  line,
  preview,
  locale,
  setQty,
  remove,
  compact = false,
}: {
  line: CartLine;
  preview: CartPreviewLine | undefined;
  locale: 'th' | 'en';
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  compact?: boolean;
}) {
  const name =
    preview?.productName[locale] ??
    preview?.productName.en ??
    preview?.productName.th ??
    line.variantId;
  const subtitle = preview ? Object.values(preview.optionValues).join(' / ') : '';
  const unit = preview?.unitPriceThb ?? 0;
  const lineTotal = unit * line.qty;
  const href = preview ? `/${locale}/product/${preview.productSlug}` : undefined;
  const imgBox = compact ? 'h-20 w-20' : 'h-24 w-24 shrink-0 sm:h-44 sm:w-44';

  const image = (
    <div className={`overflow-hidden bg-field ${imgBox}`}>
      {preview?.imageUrl ? (
        <Image
          src={preview.imageUrl}
          alt={name}
          width={400}
          height={400}
          className="h-full w-full object-cover"
        />
      ) : null}
    </div>
  );

  return (
    <div className={`flex gap-4 ${compact ? 'py-4' : 'py-6 sm:gap-6'}`}>
      {href ? <Link href={href}>{image}</Link> : image}
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            {href ? (
              <Link
                href={href}
                className={`font-serif text-ink ${compact ? 'text-base' : 'text-xl'}`}
              >
                {name}
              </Link>
            ) : (
              <p className={`font-serif text-ink ${compact ? 'text-base' : 'text-xl'}`}>{name}</p>
            )}
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => remove(line.variantId)}
            className="text-muted transition-colors hover:text-ink"
            aria-label="remove"
          >
            ×
          </button>
        </div>
        <div className="mt-auto flex items-end justify-between pt-4">
          <div className="inline-flex items-center border border-line">
            <button
              type="button"
              onClick={() => setQty(line.variantId, line.qty - 1)}
              className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
              aria-label="decrease"
            >
              −
            </button>
            <span className="w-8 text-center text-sm text-ink">{line.qty}</span>
            <button
              type="button"
              onClick={() => setQty(line.variantId, line.qty + 1)}
              className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
              aria-label="increase"
            >
              +
            </button>
          </div>
          <p className="text-sm text-ink">฿{lineTotal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
