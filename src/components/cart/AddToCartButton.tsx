'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/cart-store';

export function AddToCartButton({
  variantId,
  ready,
  outOfStock,
  preorder = false,
}: {
  variantId: string | null;
  ready: boolean;
  outOfStock: boolean;
  preorder?: boolean;
}) {
  const t = useTranslations('pdp');
  const tp = useTranslations('preorder');
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);

  const disabled = !ready || (!preorder && outOfStock) || !variantId;

  return (
    <Button
      variant="solid"
      size="lg"
      className="w-full"
      disabled={disabled}
      onClick={() => {
        if (!variantId) return;
        add({ variantId, qty: 1 });
        setAdded(true);
        setTimeout(() => setAdded(false), 1300);
      }}
    >
      {added ? (
        <span className="inline-flex items-center gap-2">
          <span key="check" className="animate-pop inline-block" aria-hidden>
            ✓
          </span>
          {t('added')}
        </span>
      ) : !ready ? (
        t('selectSize')
      ) : !preorder && outOfStock ? (
        t('outOfStock')
      ) : preorder ? (
        tp('cta')
      ) : (
        t('addToCart')
      )}
    </Button>
  );
}
