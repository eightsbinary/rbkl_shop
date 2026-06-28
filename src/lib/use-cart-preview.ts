'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';
import type { CartPreviewLine } from '@/server/queries/cart';

/** Shared cart view-model: store lines + server preview (names/prices/images) +
 *  derived subtotal/count, plus the mutators both the page and drawer need. */
export function useCartPreview() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setOpen = useCart((s) => s.setOpen);
  const [preview, setPreview] = useState<CartPreviewLine[]>([]);

  useEffect(() => {
    if (lines.length === 0) {
      setPreview([]);
      return;
    }
    const ids = lines.map((l) => l.variantId);
    fetch('/api/cart/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json() as Promise<CartPreviewLine[]>)
      .then(setPreview)
      .catch(() => setPreview([]));
  }, [lines]);

  const subtotal = lines.reduce((acc, l) => {
    const p = preview.find((x) => x.variantId === l.variantId);
    return acc + (p?.unitPriceThb ?? 0) * l.qty;
  }, 0);
  const count = lines.reduce((acc, l) => acc + l.qty, 0);

  return { lines, preview, subtotal, count, setQty, remove, setOpen };
}
