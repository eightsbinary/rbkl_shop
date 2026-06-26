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
  const [pending, setPending] = useState(false);

  const disabled = !ready || outOfStock || !variantId || pending;

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={disabled}
      onClick={() => {
        if (!variantId) return;
        setPending(true);
        add({ variantId, qty: 1 });
        setOpen(true);
        setTimeout(() => setPending(false), 220);
      }}
    >
      {!ready ? t('selectSize') : outOfStock ? t('outOfStock') : t('addToCart')}
    </Button>
  );
}
