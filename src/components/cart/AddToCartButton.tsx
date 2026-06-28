'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/cart-store';

export function AddToCartButton({
  variantId,
  ready,
  outOfStock,
}: {
  variantId: string | null;
  ready: boolean;
  outOfStock: boolean;
}) {
  const t = useTranslations('pdp');
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const [added, setAdded] = useState(false);

  const disabled = !ready || outOfStock || !variantId;

  return (
    <Button
      variant="solid"
      size="lg"
      className="w-full"
      disabled={disabled}
      onClick={() => {
        if (!variantId) return;
        add({ variantId, qty: 1 });
        setOpen(true);
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
      ) : outOfStock ? (
        t('outOfStock')
      ) : (
        t('addToCart')
      )}
    </Button>
  );
}
