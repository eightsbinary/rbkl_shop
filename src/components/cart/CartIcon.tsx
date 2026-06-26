'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';

export function CartIcon({ label }: { label: string }) {
  const count = useCart((s) => s.count());
  const setOpen = useCart((s) => s.setOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-sm text-ink-soft hover:text-ink transition-colors duration-150 ease-out-soft"
      aria-label="Open cart"
    >
      {label} {mounted ? `(${count})` : ''}
    </button>
  );
}
